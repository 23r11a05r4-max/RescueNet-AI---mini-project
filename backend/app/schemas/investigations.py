from pydantic import BaseModel
from typing import Optional, List

class InvestigationIn(BaseModel):
    person_name: str
    age: int
    gender: str  # M/F/O
    last_seen_location: str
    district: str
    city: str
    state: str
    lat: float
    lng: float
    description: str
    priority: str = "Medium"  # Low/Medium/High/Critical
    reporter_contact: Optional[str] = None
    reporter_email: Optional[str] = None
    last_seen_date_time: Optional[str] = None
    physical_description: Optional[str] = None
    special_marks: Optional[str] = None
    clothing_description: Optional[str] = None
    additional_notes: Optional[str] = None
    photo_url: Optional[str] = None
    gdpr_consent: bool = False
    search_radius: int = 5000

class AlertIn(BaseModel):
    investigation_id: str
    event_type: str
    priority: str
    description: str
    action_required: Optional[str] = None

class StatusUpdateIn(BaseModel):
    status: str

class AssignmentIn(BaseModel):
    assigned_station: Optional[str] = None
    assigned_ngos: Optional[List[str]] = None

class RehabilitationIn(BaseModel):
    rehabilitation_status: str
    progress_percentage: int
    updates: str

class RadiusUpdateIn(BaseModel):
    radius: int
