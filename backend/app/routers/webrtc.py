import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List

router = APIRouter(prefix="/ws/webrtc", tags=["webrtc"])

# In-memory mapping of active signaling session rooms
# Maps room_id -> list of active peer WebSocket links
active_rooms: Dict[str, List[WebSocket]] = {}

@router.websocket("/{room_id}/{user_id}")
async def webrtc_signaling(websocket: WebSocket, room_id: str, user_id: str):
    """
    WebSocket signaling router facilitating SDP exchange and ICE candidates transmission
    between browser clients (Citizen, Police, NGO) for peer-to-peer WebRTC calls.
    """
    await websocket.accept()
    if room_id not in active_rooms:
        active_rooms[room_id] = []
        
    active_rooms[room_id].append(websocket)
    
    # Notify existing peers in the call room
    for client in active_rooms[room_id]:
        if client != websocket:
            await client.send_json({
                "type": "peer_joined", 
                "user_id": user_id
            })
            
    try:
        while True:
            # Relay signaling coordinates
            message_raw = await websocket.receive_text()
            message = json.loads(message_raw)
            
            # Forward payload (SDP offer, answer, or candidate details)
            for client in active_rooms[room_id]:
                if client != websocket:
                    await client.send_text(message_raw)
                    
    except WebSocketDisconnect:
        active_rooms[room_id].remove(websocket)
        if not active_rooms[room_id]:
            del active_rooms[room_id]
            
        # Notify remaining call participants
        for client in active_rooms.get(room_id, []):
            await client.send_json({
                "type": "peer_left", 
                "user_id": user_id
            })
