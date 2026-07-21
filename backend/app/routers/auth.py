import uuid
from fastapi import APIRouter, HTTPException, Depends
from app.schemas.auth import RegisterIn, LoginIn
from app.database import users_col
from app.utils.security import hash_password, verify_password, sanitize_text
from app.utils.date import now_iso
from app.middleware.auth import create_token, get_current_user
from app.services.audit_service import log_action

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register")
async def register(data: RegisterIn):
    """
    Registers a new system user and grants a token.
    """
    if data.role not in ("admin", "police", "ngo", "citizen"):
        raise HTTPException(status_code=400, detail="Invalid role")
    
    email = data.email.strip().lower()
    existing = await users_col.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    uid = str(uuid.uuid4())
    hashed = hash_password(data.password)
    doc = {
        "id": uid,
        "name": sanitize_text(data.name),
        "email": email,
        "password": hashed,
        "role": data.role,
        "department": sanitize_text(data.department) if data.department else None,
        "created_at": now_iso()
    }
    await users_col.insert_one(doc)
    token = create_token(uid, data.role, email)
    
    # Audit log
    await log_action(uid, email, data.role, "REGISTER", f"User registered under role: {data.role}")
    
    return {
        "token": token,
        "user": {
            "id": uid, 
            "name": data.name, 
            "email": email, 
            "role": data.role,
            "department": data.department
        }
    }

@router.post("/login")
async def login(data: LoginIn):
    """
    Validates user credentials and issues a JWT token.
    """
    email = data.email.strip().lower()
    user = await users_col.find_one({"email": email})
    
    if not user or not verify_password(data.password, user["password"]):
         raise HTTPException(status_code=401, detail="Invalid credentials")
         
    token = create_token(user["id"], user["role"], user["email"])
    
    # Audit log
    await log_action(user["id"], user["email"], user["role"], "LOGIN", f"Successful session login")
    
    return {
        "token": token,
        "user": {
            "id": user["id"], 
            "name": user["name"], 
            "email": user["email"], 
            "role": user["role"],
            "department": user.get("department")
        }
    }

@router.get("/me")
async def me(user=Depends(get_current_user)):
    """
    Fetch the currently authenticated user profile.
    """
    return user
