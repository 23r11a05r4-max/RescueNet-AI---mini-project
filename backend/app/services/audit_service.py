import uuid
from app.database import audit_logs_col
from app.utils.date import now_iso

async def log_action(user_id: str, email: str, role: str, action: str, details: str):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "email": email,
        "role": role,
        "action": action,
        "details": details,
        "timestamp": now_iso()
    }
    await audit_logs_col.insert_one(doc)
    return doc
