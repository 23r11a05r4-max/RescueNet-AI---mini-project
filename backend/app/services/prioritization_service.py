import uuid
import math
from typing import Dict, Any, List, Tuple
from app.database import db
from app.utils.date import now_iso

def calculate_risk_priority(case: Dict[str, Any], hotspots_count: int = 0) -> Tuple[str, int, List[str]]:
    """
    Computes a smart risk score (0-100), priority level (Low/Medium/High/Critical),
    and a list of actionable AI recommendations.
    """
    score = 15  # base score
    recs = []

    # 1. Age Factor
    age = case.get("age", 25)
    if age <= 8:
        score += 30
        recs.append("Extremely high risk minor. Coordinate emergency search squads.")
    elif age <= 12:
        score += 20
        recs.append("Vulnerable child. Dispatch local police search operations.")
    elif age <= 17:
        score += 10
        recs.append("Minor age tracking protocol active.")
    elif age >= 65:
        score += 20
        recs.append("Elderly citizen. Scan local hospital networks and transit nodes.")

    # 2. Medical Conditions (Scan text description)
    text_to_scan = " ".join([
        case.get("description") or "",
        case.get("physical_description") or "",
        case.get("identification_marks") or "",
        case.get("additional_notes") or ""
    ]).lower()

    medical_keywords = [
        "diabetes", "asthma", "heart", "illness", "medical", "dementia", 
        "autism", "disabled", "wheelchair", "blind", "deaf", "condition",
        "insulin", "mental", "retard", "disability", "seizure", "medicine"
    ]
    has_medical = any(kw in text_to_scan for kw in medical_keywords)
    if has_medical:
        score += 25
        recs.append("Critical medical condition reported. Alert EMS and local hospitals.")

    # 3. AI Face Match Sighting Confidence
    ai_matches = case.get("ai_matches") or []
    cctv_hits = case.get("cctv_hits") or []
    has_high_confidence = False
    
    for m in ai_matches:
        if m.get("score", 0) >= 0.85:
            has_high_confidence = True
            
    if has_high_confidence:
        score += 20
        recs.append("High-confidence AI face recognition match detected. Deploy team to camera coordinates.")
    elif len(cctv_hits) > 0:
        score += 10
        recs.append("CCTV detection sighting reported. Review CCTV footage log streams.")

    # 4. Regional Hotspots Risk
    if hotspots_count >= 3:
        score += 15
        recs.append("Last seen location is inside a high-incidence regional case hotspot. Notify nearby patrol blocks.")
    elif hotspots_count > 0:
        score += 5

    # Cap score between 0 and 100
    score = min(100, max(0, score))

    # Map score to priority levels
    if score >= 75:
        priority = "Critical"
        recs.append("ESCALATE case to senior rescue director immediately.")
        recs.append("Trigger emergency AMBER alert broadcast to citizen networks.")
    elif score >= 50:
        priority = "High"
        recs.append("Alert closest NGO units and active patrol stations.")
        recs.append("Initiate radial tracking sweep within a 15km perimeter.")
    elif score >= 25:
        priority = "Medium"
        recs.append("Distribute standard local broadcast warnings.")
        recs.append("Assign to NGO ChildLine team for routine checkups.")
    else:
        priority = "Low"
        recs.append("Monitor case status registers. Perform standard data trace.")

    # Remove duplicates from recommendations
    unique_recs = []
    for r in recs:
        if r not in unique_recs:
            unique_recs.append(r)

    return priority, score, unique_recs


async def add_timeline_event(case_id: str, event_type: str, description: str, details: Dict[str, Any] = None):
    """
    Appends a new chronological event marker to the case folder history timeline.
    Automatically triggers AI risk recalculation.
    """
    event = {
        "id": str(uuid.uuid4()),
        "event_type": event_type,
        "description": description,
        "timestamp": now_iso(),
        "details": details or {}
    }
    
    # Retrieve case
    case = await db.investigations.find_one({"id": case_id})
    if not case:
        return
        
    timeline = case.get("timeline") or []
    timeline.append(event)
    
    # Sort timeline chronologically by timestamp
    timeline.sort(key=lambda x: x["timestamp"])

    # Recalculate hotspots count in the same city
    city = case.get("city")
    hotspots_count = 0
    if city:
        hotspots_count = await db.investigations.count_documents({
            "city": {"$regex": city, "$options": "i"},
            "status": {"$ne": "recovered"}
        })

    # Recalculate AI Risk priority parameters
    priority, score, recommendations = calculate_risk_priority(case, hotspots_count)

    # Save to db
    await db.investigations.update_one(
        {"id": case_id},
        {
            "$set": {
                "timeline": timeline,
                "priority": priority,
                "priority_score": score,
                "ai_recommendations": recommendations,
                "updated_at": now_iso()
            }
        }
    )
