from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from app.database import alerts_col, investigations_col
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("")
async def list_alerts(
    limit: int = 50, 
    since: Optional[str] = None, 
    priority: Optional[str] = None, 
    user=Depends(get_current_user)
):
    """
    Lists real-time notifications with role-based visibility filtering.
    """
    q = {}
    if since:
        q["timestamp"] = {"$gt": since}
    if priority:
        q["priority"] = priority
        
    # RBAC filter on alerts
    if user["role"] == "citizen":
        # Citizens only see alert entries related to their reported cases
        cases = await investigations_col.find({"reporter_id": user["id"]}, {"id": 1}).to_list(1000)
        case_ids = [c["id"] for c in cases]
        q["investigation_id"] = {"$in": case_ids}
    elif user["role"] == "ngo":
        # NGOs only see alert entries related to their assigned rescue cases
        dept = user.get("department") or ""
        cases = await investigations_col.find({"assigned_ngos": dept}, {"id": 1}).to_list(1000)
        case_ids = [c["id"] for c in cases]
        q["investigation_id"] = {"$in": case_ids}
        
    items = await alerts_col.find(q, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return items

@router.post("/{alert_id}/read")
async def mark_read(alert_id: str, user=Depends(get_current_user)):
    """
    Appends the user's ID to the read list to dismiss notification badges.
    """
    await alerts_col.update_one({"id": alert_id}, {"$addToSet": {"read_by": user["id"]}})
    return {"ok": True}
