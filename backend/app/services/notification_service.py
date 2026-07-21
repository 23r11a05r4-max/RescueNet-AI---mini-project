import uuid
from typing import List
from fastapi import WebSocket
from app.database import alerts_col, investigations_col
from app.utils.date import now_iso

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

async def emit_alert(investigation_id: str, event_type: str, priority: str, description: str, action_required: str = ""):
    inv = await investigations_col.find_one({"id": investigation_id}, {"_id": 0})
    status = inv.get("status", "open") if inv else "unknown"
    doc = {
        "id": str(uuid.uuid4()),
        "investigation_id": investigation_id,
        "event_type": event_type,
        "priority": priority,
        "description": description,
        "action_required": action_required or "Review update",
        "status": status,
        "timestamp": now_iso(),
        "read_by": [],
    }
    await alerts_col.insert_one(doc.copy())
    
    # Broadcast to connected sockets
    await manager.broadcast({
        "type": "NEW_ALERT",
        "data": doc
    })
    
    print(f"[ALERT BROADCAST] Event: {event_type} | Priority: {priority} | Msg: {description}")
    return doc
