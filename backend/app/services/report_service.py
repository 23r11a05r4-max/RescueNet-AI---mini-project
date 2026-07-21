import csv
import io
from app.utils.date import now_iso

def generate_case_csv(investigation: dict, timeline: list) -> str:
    """
    Generates a CSV report summarizing a single investigation.
    """
    buf = io.StringIO()
    writer = csv.writer(buf)
    
    writer.writerow(["========================================="])
    writer.writerow(["RESCUENET-AI CASE FILE REPORT"])
    writer.writerow(["========================================="])
    writer.writerow(["Case ID", investigation.get("id")])
    writer.writerow(["Person Name", investigation.get("person_name")])
    writer.writerow(["Age", investigation.get("age")])
    writer.writerow(["Gender", investigation.get("gender")])
    writer.writerow(["Priority", investigation.get("priority")])
    writer.writerow(["Status", investigation.get("status")])
    writer.writerow(["Last Seen Location", investigation.get("last_seen_location")])
    writer.writerow(["District", investigation.get("district")])
    writer.writerow(["City", investigation.get("city")])
    writer.writerow(["State", investigation.get("state")])
    writer.writerow(["Reported At", investigation.get("reported_at")])
    writer.writerow([])
    
    writer.writerow(["========================================="])
    writer.writerow(["TIMELINE & DETECTIONS LOG"])
    writer.writerow(["========================================="])
    writer.writerow(["Timestamp", "Event Type", "Priority", "Description", "Action Required"])
    
    for log in timeline:
        writer.writerow([
            log.get("timestamp"),
            log.get("event_type"),
            log.get("priority"),
            log.get("description"),
            log.get("action_required", "")
        ])
        
    return buf.getvalue()

def generate_global_summary_csv(overview: dict, executive: dict) -> str:
    """
    Generates a CSV report detailing global Command Center statistics.
    """
    buf = io.StringIO()
    writer = csv.writer(buf)
    
    writer.writerow(["COMMAND METRIC", "CURRENT VALUE"])
    writer.writerow(["-----------------------------", "-------------"])
    
    combined = {**overview, **executive}
    for key, value in combined.items():
        writer.writerow([
            key.replace("_", " ").upper(),
            str(value)
        ])
        
    return buf.getvalue()
