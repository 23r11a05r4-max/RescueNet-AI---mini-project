import os
import uuid
import shutil
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from typing import Optional, List
from app.database import db, investigations_col
from app.middleware.auth import require_roles, get_current_user
from app.schemas.investigations import InvestigationIn, AlertIn, StatusUpdateIn, AssignmentIn, RehabilitationIn, RadiusUpdateIn
from app.utils.security import sanitize_payload
from app.utils.date import now_iso
from app.services.notification_service import emit_alert
from app.services.audit_service import log_action
from app.services.file_service import get_upload_path, get_url_path
from app.services.cv_service import extract_and_analyze_frames
from app.config import ROOT_DIR

router = APIRouter(prefix="/investigations", tags=["investigations"])

@router.post("")
async def create_investigation(data: InvestigationIn, user=Depends(get_current_user)):
    """
    Registers a new missing child report in the system.
    """
    inv_id = str(uuid.uuid4())
    sanitized_data = sanitize_payload(data.model_dump())
    doc = {
        "id": inv_id,
        **sanitized_data,
        "status": "open",
        "reporter_id": user["id"],
        "reporter_name": user["name"],
        "assigned_station": None,
        "assigned_ngos": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "reported_at": now_iso(),
        "recovered_at": None,
        "ai_matches": [],
        "cctv_hits": [],
        "movement_path": [],
        "evidence": [],
        "rehabilitation_updates": [],
        "timeline": [],
    }
    await investigations_col.insert_one(doc)
    
    # Emit alert
    await emit_alert(
        inv_id, "report_submitted", data.priority,
        f"New missing child report submitted: {data.person_name}, Age {data.age}",
        "Assign to police station and NGOs"
    )
    
    # Audit log
    await log_action(
        user["id"], user["email"], user["role"],
        "CASE_CREATE", f"Reported missing child: {data.person_name} (Case ID: {inv_id})"
    )
    
    doc.pop("_id", None)
    return doc

@router.get("")
async def list_investigations(
    status: Optional[str] = None,
    search: Optional[str] = None,
    gender: Optional[str] = None,
    priority: Optional[str] = None,
    min_age: Optional[int] = None,
    max_age: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort_by: Optional[str] = "created_at",
    sort_dir: Optional[str] = "desc",
    page: int = 1,
    page_size: int = 100,
    paginated: bool = False,
    user=Depends(get_current_user)
):
    """
    Lists investigations based on user role-based permissions with advanced filters, sorting, and pagination.
    """
    q = {}
    if user["role"] == "citizen":
        q["reporter_id"] = user["id"]
    elif user["role"] == "ngo":
        q["assigned_ngos"] = user.get("department") or "ChildLine India"
        
    if status:
        q["status"] = status
    if search:
        q["$or"] = [
            {"person_name": {"$regex": search, "$options": "i"}},
            {"last_seen_location": {"$regex": search, "$options": "i"}},
            {"district": {"$regex": search, "$options": "i"}},
            {"city": {"$regex": search, "$options": "i"}},
            {"state": {"$regex": search, "$options": "i"}}
        ]
    if gender:
        q["gender"] = gender
    if priority:
        q["priority"] = priority
    if min_age is not None or max_age is not None:
        q["age"] = {}
        if min_age is not None:
            q["age"]["$gte"] = min_age
        if max_age is not None:
            q["age"]["$lte"] = max_age
    if start_date or end_date:
        q["reported_at"] = {}
        if start_date:
            q["reported_at"]["$gte"] = start_date
        if end_date:
            q["reported_at"]["$lte"] = end_date
            
    direction = -1 if sort_dir == "desc" else 1
    sort_field = "created_at"
    if sort_by == "age":
        sort_field = "age"
    elif sort_by == "person_name":
        sort_field = "person_name"
        
    skip = (page - 1) * page_size
    cursor = investigations_col.find(q, {"_id": 0}).sort(sort_field, direction)
    
    if paginated:
        total = await investigations_col.count_documents(q)
        items = await cursor.skip(skip).limit(page_size).to_list(page_size)
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total > 0 else 0
        }
    else:
        items = await cursor.limit(page_size).to_list(page_size)
        return items

@router.get("/{inv_id}")
async def get_investigation(inv_id: str, user=Depends(get_current_user)):
    """
    Retrieves investigation details. Enforces role security.
    """
    inv = await investigations_col.find_one({"id": inv_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
        
    # Check access permission
    if user["role"] == "citizen" and inv.get("reporter_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden. You do not own this case.")
    elif user["role"] == "ngo" and user.get("department") not in inv.get("assigned_ngos", []):
        raise HTTPException(status_code=403, detail="Forbidden. Case not assigned to your organization.")
        
    return inv

@router.patch("/{inv_id}")
async def update_investigation(inv_id: str, body: dict, user=Depends(get_current_user)):
    inv = await investigations_col.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    if user["role"] not in ("admin", "police") and inv.get("reporter_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden. You do not own this report.")
    allowed_fields = {
        "person_name", "age", "gender", "last_seen_location", "district", "city", "state",
        "lat", "lng", "description", "priority", "reporter_contact", "photo_url", "gdpr_consent"
    }
    update_data = {k: v for k, v in body.items() if k in allowed_fields}
    update_data["updated_at"] = now_iso()
    await investigations_col.update_one({"id": inv_id}, {"$set": update_data})
    await emit_alert(inv_id, "status_changed", inv.get("priority", "Medium"),
                     f"Investigation report details updated by {user['name']}", "Review changes")
    await log_action(user["id"], user["email"], user["role"], "CASE_UPDATE", f"Updated details of case {inv_id}")
    return {"ok": True}

@router.delete("/{inv_id}")
async def delete_investigation(inv_id: str, user=Depends(get_current_user)):
    inv = await investigations_col.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
    if user["role"] not in ("admin", "police") and inv.get("reporter_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden. You do not own this report.")
    await investigations_col.delete_one({"id": inv_id})
    await db.alerts.delete_many({"investigation_id": inv_id})
    await log_action(user["id"], user["email"], user["role"], "CASE_DELETE", f"Deleted case file {inv_id}")
    return {"ok": True}

@router.patch("/{inv_id}/status")
async def update_status(inv_id: str, body: StatusUpdateIn, user=Depends(require_roles("admin", "police"))):
    """
    Updates investigation case status. restricted to Police and Admin.
    """
    new_status = body.status
    if new_status not in ("open", "in_progress", "recovered", "closed"):
        raise HTTPException(status_code=400, detail="Invalid status value")
        
    update = {"status": new_status, "updated_at": now_iso()}
    priority = "High"
    event = "status_changed"
    
    if new_status == "recovered":
        update["recovered_at"] = now_iso()
        event = "person_recovered"
        priority = "Critical"
    elif new_status == "closed":
        event = "investigation_closed"
        
    await investigations_col.update_one({"id": inv_id}, {"$set": update})
    
    # Emit alert
    await emit_alert(
        inv_id, event, priority, 
        f"Investigation status updated to: {new_status.replace('_', ' ').upper()}", 
        "Review details"
    )
    
    # Audit log
    await log_action(
        user["id"], user["email"], user["role"],
        "STATUS_UPDATE", f"Changed status of case {inv_id} to {new_status}"
    )
    
    return {"ok": True}

@router.post("/{inv_id}/events")
async def add_event(inv_id: str, data: AlertIn, user=Depends(get_current_user)):
    """
    Adds a custom manual event timeline log.
    """
    inv = await investigations_col.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
        
    sanitized = sanitize_payload(data.model_dump())
    alert = await emit_alert(
        inv_id, sanitized["event_type"], sanitized["priority"], sanitized["description"], sanitized["action_required"] or ""
    )
    
    # Audit log
    await log_action(
        user["id"], user["email"], user["role"],
        "EVENT_ADD", f"Added timeline event {sanitized['event_type']} to case {inv_id}"
    )
    
    alert.pop("_id", None)
    return alert

@router.patch("/{inv_id}/assign")
async def assign_case(inv_id: str, body: AssignmentIn, user=Depends(require_roles("admin", "police"))):
    """
    Assigns station department and active NGOs to a case file. Police/Admin only.
    """
    inv = await investigations_col.find_one({"id": inv_id})
    if not inv:
         raise HTTPException(status_code=404, detail="Case not found")
         
    sanitized_body = sanitize_payload(body.model_dump())
    update_fields = {"updated_at": now_iso()}
    if sanitized_body["assigned_station"] is not None:
        update_fields["assigned_station"] = sanitized_body["assigned_station"]
    if sanitized_body["assigned_ngos"] is not None:
        update_fields["assigned_ngos"] = sanitized_body["assigned_ngos"]
        
    await investigations_col.update_one({"id": inv_id}, {"$set": update_fields})
    
    # Emit assignment alert
    await emit_alert(
        inv_id, "assigned_to_police", "High",
        f"Case assigned to station: {sanitized_body['assigned_station'] or 'HQ'}. Active NGOs: {', '.join(sanitized_body['assigned_ngos'] or []) or 'None'}",
        "Commence operations"
    )
    
    # Audit log
    await log_action(
        user["id"], user["email"], user["role"],
        "CASE_ASSIGN", f"Assigned case {inv_id} to station {sanitized_body['assigned_station']} and NGOs {sanitized_body['assigned_ngos']}"
    )
    return {"ok": True}

@router.post("/{inv_id}/rehab")
async def upload_rehab_update(inv_id: str, body: RehabilitationIn, user=Depends(require_roles("admin", "ngo"))):
    """
    Uploads rehabilitation progress and rescue updates. NGO only.
    """
    inv = await investigations_col.find_one({"id": inv_id})
    if not inv:
         raise HTTPException(status_code=404, detail="Case not found")
         
    sanitized_body = sanitize_payload(body.model_dump())
    update_doc = {
        "id": str(uuid.uuid4()),
        "ngo_name": user["name"],
        "status": sanitized_body["rehabilitation_status"],
        "progress": sanitized_body["progress_percentage"],
        "updates": sanitized_body["updates"],
        "timestamp": now_iso()
    }
    
    await investigations_col.update_one(
        {"id": inv_id}, 
        {
            "$push": {"rehabilitation_updates": update_doc},
            "$set": {"updated_at": now_iso()}
        }
    )
    
    # Emit rehab update alert
    await emit_alert(
        inv_id, "ngo_assigned", "Medium",
        f"NGO {user['name']} added rehab report: {sanitized_body['updates']} (Progress: {sanitized_body['progress_percentage']}%)",
        "Monitor progress"
    )
    
    # Audit log
    await log_action(
        user["id"], user["email"], user["role"],
        "REHAB_UPDATE", f"NGO updated rehabilitation file for case {inv_id}"
    )
    return {"ok": True}

@router.post("/{inv_id}/evidence")
async def add_evidence_file(
    inv_id: str,
    description: str = Form(...),
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    """
    Uploads supportive documents, certificates, or child photo.
    Open to police, admins, and case citizen reporters.
    """
    inv = await investigations_col.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Case not found")
        
    # Enforce case ownership for citizens
    if user["role"] == "citizen" and inv.get("reporter_id") != user["id"]:
         raise HTTPException(status_code=403, detail="Forbidden. You do not own this case file.")
         
    # Categorise file based on extension
    ext = os.path.splitext(file.filename)[1].lower()
    category = "photos" if ext in (".jpg", ".jpeg", ".png", ".webp") else "evidence"
    
    dest_path = get_upload_path(category, file.filename)
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    rel_url = get_url_path(category, os.path.basename(dest_path))
    
    evidence_entry = {
        "id": str(uuid.uuid4()),
        "name": file.filename,
        "url": rel_url,
        "description": description,
        "uploaded_by": user["name"],
        "timestamp": now_iso()
    }
    
    # Update case document. If it is an image and case lacks photo_url, seed it as primary photo_url
    update_ops = {
        "$push": {"evidence": evidence_entry},
        "$set": {"updated_at": now_iso()}
    }
    if category == "photos" and not inv.get("photo_url"):
        update_ops["$set"]["photo_url"] = rel_url
        
    await investigations_col.update_one({"id": inv_id}, update_ops)
    
    # Emit alert
    await emit_alert(
        inv_id, "evidence_uploaded", "Medium",
        f"New supporting document/photo uploaded: {file.filename}. Desc: {description}",
        "Inspect evidence files"
    )
    
    # Audit log
    await log_action(
        user["id"], user["email"], user["role"],
        "UPLOAD_EVIDENCE", f"Uploaded evidence file {file.filename} to case {inv_id}"
    )
    return {"ok": True, "url": rel_url}

async def run_cctv_analysis_task(inv_id: str, video_path: str, child_photo_path: str, camera_id: str, file_name: str, user_id: str, user_email: str, user_role: str):
    """
    Background worker task to run OpenCV frames extraction and face similarity comparisons.
    Updates MongoDB collections, dispatches timeline alerts, and registers compliance audits.
    """
    try:
        detections = extract_and_analyze_frames(video_path, child_photo_path, camera_id)
        
        cctv_hits = []
        ai_matches = []
        movement_path = []
        
        for det in detections:
            cctv_hits.append({
                "cam": det["camera_id"],
                "time": det["timestamp"]
            })
            ai_matches.append({
                "cam": det["camera_id"],
                "score": det["confidence"],
                "time": det["timestamp"],
                "frame_url": det["frame_url"]
            })
            movement_path.append({
                "lat": det["coordinates"]["lat"],
                "lng": det["coordinates"]["lng"],
                "timestamp": det["timestamp"],
                "camera": det["camera_id"],
                "direction": det["direction"]
            })
            
            # Broadcast matched alert
            score_pct = int(det["confidence"] * 100)
            await emit_alert(
                inv_id, "ai_face_match" if det["confidence"] > 0.85 else "cctv_detection",
                "Critical" if det["confidence"] > 0.85 else "High",
                f"AI CCTV Match ({score_pct}%) at camera {det['camera_id']} moving {det['direction']}",
                "Dispatched search squad immediately"
            )
            
        # Update case investigation
        if detections:
            await investigations_col.update_one(
                {"id": inv_id},
                {
                    "$push": {
                        "cctv_hits": {"$each": cctv_hits},
                        "ai_matches": {"$each": ai_matches},
                        "movement_path": {"$each": movement_path}
                    },
                    "$set": {
                        "updated_at": now_iso()
                    }
                }
            )
        
        # Log audit trail compliance
        await log_action(
            user_id, user_email, user_role,
            "CCTV_ANALYZE_COMPLETE", f"Background CCTV analysis completed for case {inv_id}. Detections: {len(detections)}"
        )
    except Exception as e:
        # Emit error status alert
        await emit_alert(
            inv_id, "cctv_detection", "High",
            f"ERROR: Background CCTV analysis task failed for file {file_name}. Error: {str(e)}",
            "Retry analysis or inspect video codec"
        )

@router.post("/{inv_id}/cctv")
async def upload_cctv_footage(
    inv_id: str,
    background_tasks: BackgroundTasks,
    camera_id: str = Form("CAM-01"),
    file: UploadFile = File(...),
    user=Depends(require_roles("admin", "police"))
):
    """
    Police CCTV Video feed analysis.
    Saves and queues the footage for background AI processing.
    """
    inv = await investigations_col.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Case not found")
        
    # Save video file
    video_path = get_upload_path("cctv", file.filename)
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Resolve child photo local path if available
    child_photo_path = None
    if inv.get("photo_url"):
        rel_photo = inv["photo_url"].lstrip("/")
        child_photo_path = str(ROOT_DIR / rel_photo)
        
    # Queue processing to background tasks
    background_tasks.add_task(
        run_cctv_analysis_task,
        inv_id,
        str(video_path),
        child_photo_path,
        camera_id,
        file.filename,
        user["id"],
        user["email"],
        user["role"]
    )
    
    # Audit log queue
    await log_action(
        user["id"], user["email"], user["role"],
        "CCTV_UPLOAD", f"Uploaded and queued CCTV video {file.filename} for case {inv_id}."
    )
    
    return {"ok": True, "status": "processing", "message": "CCTV footage uploaded and queued for background AI facial scanning."}

@router.patch("/{inv_id}/radius")
async def update_search_radius(inv_id: str, body: RadiusUpdateIn, user=Depends(require_roles("admin", "police"))):
    """
    Updates the geofenced search radius for an investigation. restricted to Police and Admin.
    """
    if body.radius <= 0:
        raise HTTPException(status_code=400, detail="Radius must be a positive integer.")
    
    await investigations_col.update_one({"id": inv_id}, {"$set": {"search_radius": body.radius, "updated_at": now_iso()}})
    
    # Audit log
    await log_action(
        user["id"], user["email"], user["role"],
        "RADIUS_UPDATE", f"Updated search radius of case {inv_id} to {body.radius} meters"
    )
    return {"ok": True}

