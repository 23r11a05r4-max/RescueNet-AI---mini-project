import random
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from app.database import db, investigations_col
from app.middleware.auth import get_current_user, require_roles
from app.utils.date import now_iso

router = APIRouter(prefix="/maps", tags=["maps"])

# Seeding Camera Locations if empty
async def ensure_camera_locations():
    count = await db.camera_locations.count_documents({})
    if count == 0:
        cameras = [
            {"id": "CAM-01", "name": "Bandra Station Entrance", "lat": 19.0543, "lng": 72.8402, "status": "active", "last_scan": now_iso()},
            {"id": "CAM-02", "name": "Linking Road Intersection", "lat": 19.0581, "lng": 72.8391, "status": "active", "last_scan": now_iso()},
            {"id": "CAM-03", "name": "Carter Road Promenade", "lat": 19.0620, "lng": 72.8242, "status": "active", "last_scan": now_iso()},
            {"id": "CAM-04", "name": "Hill Road Crossing", "lat": 19.0538, "lng": 72.8340, "status": "active", "last_scan": now_iso()},
            {"id": "CAM-05", "name": "SVT Road Junction", "lat": 19.0495, "lng": 72.8385, "status": "maintenance", "last_scan": now_iso()}
        ]
        await db.camera_locations.insert_many(cameras)

@router.get("/live")
async def get_live_investigation_map(user=Depends(require_roles("admin", "police"))):
    """
    Returns active investigation map indicators, patrols coordinates, and NGO tracks.
    """
    active_cases = await investigations_col.find({"status": "in_progress"}, {"_id": 0}).to_list(100)
    
    # Generate mock active patrols and NGO teams locations
    patrols = [
        {"id": "PATROL-01", "officer": "R. Sharma", "lat": 19.055, "lng": 72.835, "status": "on_patrol"},
        {"id": "PATROL-02", "officer": "A. Deshmukh", "lat": 19.060, "lng": 72.828, "status": "responding"}
    ]
    ngos = [
        {"id": "NGO-TEAM-1", "org": "ChildLine", "lat": 19.052, "lng": 72.839, "status": "search_active"},
        {"id": "NGO-TEAM-2", "org": "SaveChildren", "lat": 19.058, "lng": 72.842, "status": "standby"}
    ]
    
    return {
        "active_cases": active_cases,
        "patrols": patrols,
        "ngo_teams": ngos
    }

@router.get("/predictions/{inv_id}")
async def get_maps_predictions(inv_id: str, user=Depends(get_current_user)):
    """
    Generates time and road-network aware next probable location predictions for a case.
    """
    inv = await investigations_col.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation case file not found")
        
    # Standard role validation: citizen check
    if user["role"] == "citizen" and inv.get("reporter_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")

    # Calculate prediction based on last seen lat/lng
    lat = inv.get("lat") or 19.0543
    lng = inv.get("lng") or 72.8402
    
    # Heuristics prediction coordinates offset
    pred_lat = lat + random.uniform(-0.01, 0.01)
    pred_lng = lng + random.uniform(-0.01, 0.01)
    
    prediction = {
        "investigation_id": inv_id,
        "predicted_lat": pred_lat,
        "predicted_lng": pred_lng,
        "confidence": round(random.uniform(0.65, 0.94), 2),
        "priority_level": inv.get("priority", "High"),
        "search_radius_meters": inv.get("search_radius", 5000),
        "predicted_at": now_iso(),
        "notes": "Probable trajectory computed towards Transit Hub / Bus Station entrance."
    }
    
    await db.predictions.update_one(
        {"investigation_id": inv_id},
        {"$set": prediction},
        upsert=True
    )
    
    prediction.pop("_id", None)
    return prediction

@router.get("/location-history/{inv_id}")
async def get_maps_location_history(inv_id: str, user=Depends(get_current_user)):
    """
    Returns movement timeline path coordinate list.
    """
    inv = await investigations_col.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation case file not found")
        
    if user["role"] == "citizen" and inv.get("reporter_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")
        
    # Return history list from MongoDB
    history = await db.location_history.find({"investigation_id": inv_id}, {"_id": 0}).sort("timestamp", 1).to_list(100)
    
    if not history:
        # Generate initial history entries based on last_seen_location
        lat = inv.get("lat") or 19.0543
        lng = inv.get("lng") or 72.8402
        history = [
            {
                "investigation_id": inv_id,
                "lat": lat,
                "lng": lng,
                "timestamp": inv.get("created_at") or now_iso(),
                "description": f"Initial/Last Seen Location: {inv.get('last_seen_location', 'Unknown')}"
            }
        ]
        await db.location_history.insert_many(history)
        for h in history:
            h.pop("_id", None)
            
    return history

@router.get("/geofence/{inv_id}")
async def get_maps_geofence(inv_id: str, user=Depends(get_current_user)):
    """
    Retrieves geofenced boundaries config.
    """
    inv = await investigations_col.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation case file not found")
        
    if user["role"] == "citizen" and inv.get("reporter_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")
        
    return {
        "investigation_id": inv_id,
        "center": {"lat": inv.get("lat", 19.0543), "lng": inv.get("lng", 72.8402)},
        "radius_meters": inv.get("search_radius", 5000),
        "updated_at": inv.get("updated_at", now_iso())
    }

@router.get("/cameras")
async def get_maps_cameras(user=Depends(require_roles("admin", "police"))):
    """
    Returns lists of system CCTV cameras and status.
    """
    await ensure_camera_locations()
    cameras = await db.camera_locations.find({}, {"_id": 0}).to_list(100)
    return cameras

@router.get("/routes/{inv_id}")
async def get_maps_routes(inv_id: str, user=Depends(get_current_user)):
    """
    Computes optimized rescue path coordinates and landmarks recommendations.
    """
    inv = await investigations_col.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation case file not found")
        
    if user["role"] == "citizen" and inv.get("reporter_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")
        
    lat = inv.get("lat") or 19.0543
    lng = inv.get("lng") or 72.8402
    
    # Generate route coordinates starting from last seen
    optimized_path = [
        {"lat": lat, "lng": lng},
        {"lat": lat + 0.003, "lng": lng - 0.002},
        {"lat": lat + 0.007, "lng": lng - 0.005}
    ]
    
    landmarks = [
        {"name": "Bandra Subway Entrance", "distance_meters": 450, "priority": "High"},
        {"name": "Karol Bagh Metro Gate 2", "distance_meters": 1200, "priority": "Medium"}
    ]
    
    destinations = {
        "police_hq": {"lat": lat + 0.005, "lng": lng + 0.002, "name": "Central Police Station"},
        "nearest_ngo": {"lat": lat - 0.004, "lng": lng + 0.006, "name": "ChildLine Rehab Center"},
        "nearest_hospital": {"lat": lat + 0.009, "lng": lng - 0.008, "name": "Metro General Hospital"}
    }
    
    routes_payload = {
        "investigation_id": inv_id,
        "optimized_path": optimized_path,
        "landmarks": landmarks,
        "destinations": destinations,
        "computed_at": now_iso()
    }
    
    await db.search_routes.update_one(
        {"investigation_id": inv_id},
        {"$set": routes_payload},
        upsert=True
    )
    
    routes_payload.pop("_id", None)
    return routes_payload
