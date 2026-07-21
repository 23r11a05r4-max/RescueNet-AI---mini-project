from pydantic import BaseModel

class RoleUpdateIn(BaseModel):
    role: str
