from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import PlainTextResponse
from typing import Optional
from app.database import investigations_col, alerts_col
from app.middleware.auth import require_roles, get_current_user
from app.services.report_service import generate_case_csv, generate_global_summary_csv
from app.routers.analytics import analytics_overview, executive_dashboard, analytics_demographics, analytics_geographic
from app.utils.date import now_iso
from app.services.audit_service import log_action

router = APIRouter(prefix="/reports", tags=["reports"])

@router.get("/investigation/{inv_id}")
async def report_investigation(inv_id: str, fmt: str = "json", user=Depends(get_current_user)):
    """
    Downloads or fetches a detailed report on a single investigation.
    Requires RBAC checks.
    """
    inv = await investigations_col.find_one({"id": inv_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Investigation not found")
        
    # Check access permission
    if user["role"] == "citizen" and inv.get("reporter_id") != user["id"]:
         raise HTTPException(status_code=403, detail="Access denied. You can only view your own cases.")
    elif user["role"] == "ngo" and user.get("department") not in inv.get("assigned_ngos", []):
         raise HTTPException(status_code=403, detail="Access denied. You can only view assigned cases.")
         
    timeline_logs = await alerts_col.find({"investigation_id": inv_id}, {"_id": 0}).sort("timestamp", 1).to_list(1000)
    
    # Register audit logging
    await log_action(
        user["id"], user["email"], user["role"], 
        "REPORT_GENERATE", f"Generated investigation report for case {inv_id} in {fmt} format"
    )
    
    if fmt == "csv":
        csv_string = generate_case_csv(inv, timeline_logs)
        return PlainTextResponse(
            csv_string,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="report_{inv_id}.csv"'}
        )
        
    return {
        "investigation": inv,
        "timeline": timeline_logs,
        "evidence_summary": inv.get("evidence", []),
        "ai_matches": inv.get("ai_matches", []),
        "cctv_analysis": inv.get("cctv_hits", []),
        "generated_at": now_iso()
    }

@router.get("/summary")
async def report_summary(fmt: str = "json", user=Depends(require_roles("admin", "police"))):
    """
    Downloads or fetches the global Command Center analytics summary.
    """
    overview = await analytics_overview(user=user)
    demographics = await analytics_demographics(user=user)
    geographic = await analytics_geographic(user=user)
    exec_data = await executive_dashboard(user=user)
    
    # Register audit logging
    await log_action(
        user["id"], user["email"], user["role"], 
        "SUMMARY_GENERATE", f"Generated global summary report in {fmt} format"
    )
    
    if fmt == "csv":
        csv_string = generate_global_summary_csv(overview, exec_data)
        return PlainTextResponse(
            csv_string,
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="summary.csv"'}
        )
        
    return {
        "overview": overview,
        "demographics": demographics,
        "geographic": geographic,
        "executive": exec_data,
        "generated_at": now_iso()
    }
