from pydantic import BaseModel
from typing import Optional

class ChatIn(BaseModel):
    message: str
    language: Optional[str] = "en"
