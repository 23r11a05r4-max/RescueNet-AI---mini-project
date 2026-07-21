from pydantic import BaseModel
from typing import Optional

class RegisterIn(BaseModel):
    name: str
    email: str
    password: str
    role: str = "citizen"  # admin, police, ngo, citizen
    department: Optional[str] = None
    gdpr_consent: bool = False

class LoginIn(BaseModel):
    email: str
    password: str
