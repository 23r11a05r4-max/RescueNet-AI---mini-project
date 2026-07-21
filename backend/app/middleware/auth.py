from fastapi import Header, HTTPException, Depends
import jwt
from typing import Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from app.config import JWT_SECRET
from app.database import users_col

def create_token(user_id: str, role: str, email: str) -> str:
    """
    Generates a secure HS256 JWT validation token valid for 7 days.
    """
    payload = {
        "sub": user_id, 
        "role": role, 
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """
    FastAPI dependency to validate incoming JWT Bearer tokens.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = await users_col.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def require_roles(*roles):
    """
    Decorator dependency enforcing Role-Based Access Control on FastAPI endpoints.
    """
    async def dep(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Access denied. Forbidden role.")
        return user
    return dep
