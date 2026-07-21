import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.database import db, investigations_col
from app.middleware.auth import get_current_user, require_roles
from app.utils.date import now_iso
from app.services.prioritization_service import add_timeline_event
from app.services.notification_service import emit_alert
from app.services.audit_service import log_action

router = APIRouter(prefix="/community", tags=["community"])

# --- PyDantic Schemas ---
class SightingIn(BaseModel):
    investigation_id: str
    date_time: str
    location: str
    lat: float
    lng: float
    description: str
    photo_url: Optional[str] = None
    video_url: Optional[str] = None
    reporter_contact: Optional[str] = None
    anonymous: bool = True

class ModerateSightingIn(BaseModel):
    action: str  # "approve", "reject", "spam"

class VolunteerIn(BaseModel):
    contact_details: str
    city: str
    district: str
    skills: List[str]
    availability: str = "available" # "available", "unavailable"

class JoinCampaignIn(BaseModel):
    investigation_id: str

# --- SIGHTING REPORTS ---
@router.post("/sightings")
async def submit_sighting(data: SightingIn, user=Depends(get_current_user)):
    """
    Public or citizen report of a possible sighting of a missing person case.
    """
    case = await investigations_col.find_one({"id": data.investigation_id})
    if not case:
        raise HTTPException(status_code=404, detail="Missing person case not found")
        
    sighting_id = str(uuid.uuid4())
    doc = {
        "id": sighting_id,
        "investigation_id": data.investigation_id,
        "person_name": case["person_name"],
        "date_time": data.date_time,
        "location": data.location,
        "lat": data.lat,
        "lng": data.lng,
        "description": data.description,
        "photo_url": data.photo_url,
        "video_url": data.video_url,
        "reporter_contact": None if data.anonymous else (data.reporter_contact or user["email"]),
        "anonymous": data.anonymous,
        "status": "pending",
        "created_at": now_iso()
    }
    
    await db.sightings.insert_one(doc)
    await log_action(
        user["id"], user["email"], user["role"],
        "SIGHTING_SUBMIT", f"Submitted sighting for child {case['person_name']} at {data.location}"
    )
    doc.pop("_id", None)
    return doc

@router.get("/sightings")
async def get_my_sightings(user=Depends(get_current_user)):
    """
    Get sightings associated with cases reported by this citizen.
    """
    if user["role"] == "citizen":
        own_cases = await investigations_col.find({"reporter_id": user["id"]}).to_list(100)
        own_ids = [c["id"] for c in own_cases]
        sightings = await db.sightings.find({"investigation_id": {"$in": own_ids}}, {"_id": 0}).sort("created_at", -1).to_list(100)
        return sightings
    else:
        sightings = await db.sightings.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
        return sightings

@router.get("/sightings/verified")
async def get_recent_verified_sightings():
    """
    Public endpoint displaying recently verified sightings to build awareness.
    """
    sightings = await db.sightings.find({"status": "approved"}, {"_id": 0, "reporter_contact": 0}).sort("created_at", -1).limit(10).to_list(10)
    return sightings

@router.post("/sightings/{sighting_id}/moderate")
async def moderate_sighting(sighting_id: str, data: ModerateSightingIn, user=Depends(require_roles("admin", "police"))):
    """
    Moderate a sighting: approve, reject, or mark as spam.
    """
    sighting = await db.sightings.find_one({"id": sighting_id})
    if not sighting:
        raise HTTPException(status_code=404, detail="Sighting report not found")
        
    action = data.action.lower()
    if action not in ("approve", "reject", "spam"):
        raise HTTPException(status_code=400, detail="Invalid moderation action")
        
    status = "approved" if action == "approve" else ("rejected" if action == "reject" else "spam")
    await db.sightings.update_one({"id": sighting_id}, {"$set": {"status": status}})
    
    inv_id = sighting["investigation_id"]
    case = await investigations_col.find_one({"id": inv_id})
    
    if action == "approve" and case:
        # Append verified sighting log to case folder timeline
        await add_timeline_event(
            inv_id, "new_sighting",
            f"Verified sighting: {sighting['description']} at {sighting['location']}"
        )
        
        # Trigger push warning alert
        await emit_alert(
            inv_id, "citizen_info_provided", "High",
            f"VERIFIED SIGHTING: {sighting['description']} observed at {sighting['location']}.",
            "Inspect verified sighting coordinates"
        )
        
        # Add to case movement path
        movement_entry = {
            "id": str(uuid.uuid4()),
            "lat": sighting["lat"],
            "lng": sighting["lng"],
            "timestamp": sighting["date_time"],
            "location_details": f"Public sighting: {sighting['location']}"
        }
        await investigations_col.update_one(
            {"id": inv_id},
            {
                "$push": {"movement_path": movement_entry},
                "$set": {"updated_at": now_iso()}
            }
        )

    await log_action(
        user["id"], user["email"], user["role"],
        "SIGHTING_MODERATE", f"Moderated sighting {sighting_id} as {status}"
    )
    return {"ok": True, "status": status}

# --- VOLUNTEER NETWORK ---
@router.post("/volunteers")
async def register_volunteer(data: VolunteerIn, user=Depends(get_current_user)):
    """
    Register or update the volunteer profile for the logged in user.
    """
    profile = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "contact_details": data.contact_details,
        "city": data.city,
        "district": data.district,
        "skills": data.skills,
        "availability": data.availability,
        "verified": False,
        "joined_campaigns": [],
        "participation_history": [],
        "updated_at": now_iso()
    }
    
    # Check if profile already exists to preserve verification status & campaigns
    existing = await db.volunteers.find_one({"id": user["id"]})
    if existing:
        profile["verified"] = existing.get("verified", False)
        profile["joined_campaigns"] = existing.get("joined_campaigns", [])
        profile["participation_history"] = existing.get("participation_history", [])
        
    await db.volunteers.update_one({"id": user["id"]}, {"$set": profile}, upsert=True)
    await log_action(
        user["id"], user["email"], user["role"],
        "VOLUNTEER_REGISTER", f"Registered/Updated volunteer profile for user {user['name']}"
    )
    return {"ok": True}

@router.get("/volunteers/profile")
async def get_volunteer_profile(user=Depends(get_current_user)):
    """
    Get current user's volunteer profile.
    """
    vol = await db.volunteers.find_one({"id": user["id"]}, {"_id": 0})
    if not vol:
        return {"registered": False}
    vol["registered"] = True
    return vol

@router.post("/volunteers/join-campaign")
async def join_campaign(data: JoinCampaignIn, user=Depends(get_current_user)):
    """
    Join search campaign for a specific missing person case.
    """
    vol = await db.volunteers.find_one({"id": user["id"]})
    if not vol:
        raise HTTPException(status_code=400, detail="You must register as a volunteer first")
        
    case = await investigations_col.find_one({"id": data.investigation_id})
    if not case:
        raise HTTPException(status_code=404, detail="Investigation case not found")
        
    campaigns = vol.get("joined_campaigns") or []
    if data.investigation_id in campaigns:
        return {"ok": True, "msg": "Already joined this campaign"}
        
    campaigns.append(data.investigation_id)
    history_entry = {
        "action": f"Joined search campaign for {case['person_name']}",
        "timestamp": now_iso()
    }
    
    await db.volunteers.update_one(
        {"id": user["id"]},
        {
            "$set": {"joined_campaigns": campaigns},
            "$push": {"participation_history": history_entry}
        }
    )
    
    # Also add timeline event logging volunteer mobilization!
    await add_timeline_event(
        data.investigation_id, "ngo_assigned",
        f"Volunteer network mobilized: {user['name']} joined the search campaign."
    )
    
    return {"ok": True}

@router.get("/volunteers")
async def list_volunteers(user=Depends(require_roles("admin", "police"))):
    """
    List registered volunteers for admin reviews.
    """
    volunteers = await db.volunteers.find({}, {"_id": 0}).to_list(1000)
    return volunteers

@router.post("/volunteers/{vol_id}/verify")
async def toggle_volunteer_verification(vol_id: str, user=Depends(require_roles("admin"))):
    """
    Toggle volunteer verification status.
    """
    vol = await db.volunteers.find_one({"id": vol_id})
    if not vol:
        raise HTTPException(status_code=404, detail="Volunteer not found")
        
    new_verified = not vol.get("verified", False)
    await db.volunteers.update_one({"id": vol_id}, {"$set": {"verified": new_verified}})
    
    await log_action(
        user["id"], user["email"], user["role"],
        "VOLUNTEER_VERIFY", f"Toggled volunteer {vol['name']} verification status to {new_verified}"
    )
    return {"ok": True, "verified": new_verified}

@router.get("/volunteers/stats")
async def get_volunteer_stats():
    """
    Stats for community portal: active volunteers count and contributions.
    """
    total_volunteers = await db.volunteers.count_documents({})
    active_volunteers = await db.volunteers.count_documents({"availability": "available"})
    verified_volunteers = await db.volunteers.count_documents({"verified": True})
    total_sightings = await db.sightings.count_documents({})
    verified_sightings = await db.sightings.count_documents({"status": "approved"})
    
    return {
        "total_volunteers": total_volunteers,
        "active_volunteers": active_volunteers,
        "verified_volunteers": verified_volunteers,
        "total_sightings": total_sightings,
        "verified_sightings": verified_sightings
    }
