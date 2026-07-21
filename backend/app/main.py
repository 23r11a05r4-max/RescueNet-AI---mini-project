import logging
from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS, UPLOADS_DIR
from app.database import db, client, investigations_col
from app.routers import auth, admin, alerts, analytics, reports, investigations, ai, webrtc, telephony, maps, rag, agents, integrations, chat
from app.middleware.rate_limit import rate_limiter_dependency
from app.middleware.security import EnterpriseSecurityHeadersMiddleware
from app.utils.date import now_iso
import uuid
import random
import bcrypt
from datetime import datetime, timezone, timedelta

# Create FastAPI app
app = FastAPI(
    title="Sentinel Command API", 
    description="AI-powered Missing Child Investigation and Rescue Platform API",
    version="2.0",
    dependencies=[Depends(rate_limiter_dependency)] # Global rate limiting protection
)

# CORS Middlewares
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enterprise Security Headers Middleware (XSS, CSP, frame protections)
app.add_middleware(EnterpriseSecurityHeadersMiddleware)

# Serve uploaded files statically (Photos, CCTV frames, evidence files)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Include Modular API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(investigations.router, prefix="/api")
app.include_router(alerts.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(maps.router, prefix="/api")
app.include_router(rag.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(integrations.router, prefix="/api")
app.include_router(integrations.webhooks_router, prefix="/api")
app.include_router(integrations.cloud_router, prefix="/api")
app.include_router(integrations.crm_router, prefix="/api")
app.include_router(integrations.erp_router, prefix="/api")
app.include_router(integrations.government_router, prefix="/api")
app.include_router(integrations.services_router, prefix="/api")
app.include_router(chat.router, prefix="/api")

# Include Telephony & WebRTC Routers
app.include_router(webrtc.router, prefix="/api")
app.include_router(telephony.router, prefix="/api")

# Core Health Check Endpoint
@app.get("/api")
async def api_health():
    return {"service": "Sentinel Command API", "status": "online"}

@app.get("/")
async def root():
    return {"service": "Sentinel Command", "status": "online"}

# Seeding Logic for Demo Setup
async def seed_data():
    existing = await investigations_col.count_documents({})
    if existing > 5:
        return {"ok": True, "message": "Already seeded", "count": existing}

    # Seed Users
    demo_users = [
        {"name": "Admin Kaur", "email": "admin@sentinel.gov", "password": "admin123", "role": "admin", "department": "HQ"},
        {"name": "Insp. Rajan Menon", "email": "police@sentinel.gov", "password": "police123", "role": "police", "department": "Central Station"},
        {"name": "Priya NGO Lead", "email": "ngo@sentinel.gov", "password": "ngo123", "role": "ngo", "department": "ChildLine India"},
        {"name": "Citizen Devi", "email": "citizen@sentinel.gov", "password": "citizen123", "role": "citizen", "department": None},
    ]
    for u in demo_users:
        if not await db.users.find_one({"email": u["email"]}):
            hashed = bcrypt.hashpw(u["password"].encode(), bcrypt.gensalt()).decode()
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "name": u["name"], "email": u["email"],
                "password": hashed, "role": u["role"], "department": u["department"],
                "created_at": now_iso(),
            })

    # Seed Sample investigations across districts in India
    districts = [
        ("Bandra", "Mumbai", "Maharashtra", 19.0596, 72.8295),
        ("Andheri", "Mumbai", "Maharashtra", 19.1197, 72.8464),
        ("Dadar", "Mumbai", "Maharashtra", 19.0178, 72.8478),
        ("Koramangala", "Bengaluru", "Karnataka", 12.9352, 77.6245),
        ("Whitefield", "Bengaluru", "Karnataka", 12.9698, 77.7500),
        ("Connaught Place", "New Delhi", "Delhi", 28.6315, 77.2167),
        ("Karol Bagh", "New Delhi", "Delhi", 28.6519, 77.1907),
        ("T. Nagar", "Chennai", "Tamil Nadu", 13.0418, 80.2341),
        ("Salt Lake", "Kolkata", "West Bengal", 22.5867, 88.4172),
        ("Hitech City", "Hyderabad", "Telangana", 17.4435, 78.3772),
    ]
    priorities = ["Low", "Medium", "High", "Critical"]
    genders = ["M", "F", "O"]
    names = ["Aarav Sharma","Isha Patel","Rohan Verma","Meera Iyer","Kabir Singh","Ananya Rao","Vikram Nair","Tara Bose","Aditya Kumar","Riya Menon","Aryan Das","Diya Kapoor","Neha Gupta","Aditi Joshi","Saanvi Shah","Ishaan Reddy","Kavya Pillai","Zara Khan","Aayush Mehta","Nitya Rao"]

    users = await db.users.find({}, {"_id": 0}).to_list(50)
    reporter = users[0]

    now = datetime.now(timezone.utc)
    inv_ids = []
    for idx in range(24):
        d = districts[idx % len(districts)]
        reported = now - timedelta(days=random.randint(0, 40), hours=random.randint(0, 23))
        age = random.choice([6, 10, 12, 15, 22, 34, 45, 62])
        status = random.choices(["open","in_progress","recovered","closed"], weights=[3,3,3,1])[0]
        recovered_at = None
        if status == "recovered":
            recovered_at = (reported + timedelta(hours=random.randint(6, 96))).isoformat()
        inv_id = str(uuid.uuid4())
        inv_ids.append(inv_id)
        doc = {
            "id": inv_id,
            "person_name": names[idx % len(names)],
            "age": age,
            "gender": random.choice(genders),
            "last_seen_location": f"Near {d[0]} market",
            "district": d[0], "city": d[1], "state": d[2],
            "lat": d[3] + random.uniform(-0.02, 0.02),
            "lng": d[4] + random.uniform(-0.02, 0.02),
            "description": f"Wearing school uniform. Last seen at {d[0]}.",
            "priority": random.choices(priorities, weights=[1,3,3,2])[0],
            "photo_url": None,
            "reporter_id": reporter["id"], "reporter_name": reporter["name"],
            "status": status,
            "assigned_station": "Central Station" if random.random() > 0.3 else None,
            "assigned_ngos": ["ChildLine India"] if random.random() > 0.5 else [],
            "created_at": reported.isoformat(), "updated_at": reported.isoformat(),
            "reported_at": reported.isoformat(), "recovered_at": recovered_at,
            "ai_matches": [{"score": round(random.uniform(0.7, 0.98), 2), "cam": f"CAM-{random.randint(1,50)}"} for _ in range(random.randint(0, 3))],
            "cctv_hits": [{"cam": f"CAM-{random.randint(1,50)}", "time": (reported+timedelta(hours=random.randint(1,20))).isoformat()} for _ in range(random.randint(0,4))],
            "movement_path": [], "evidence": [], "timeline": [],
            "rehabilitation_updates": [],
            "gdpr_consent": True
        }
        await db.investigations.insert_one(doc)

        # Seed Timeline events & Alerts
        events_pool = [
            ("report_submitted", doc["priority"], f"New missing report: {doc['person_name']}"),
            ("assigned_to_police", "High", f"Assigned to {doc['assigned_station'] or 'Central Station'}"),
            ("ai_face_match", "Critical", f"AI matched face at CAM-{random.randint(1,50)} with 92% confidence"),
            ("cctv_detection", "High", f"CCTV detection at {d[0]} junction"),
            ("citizen_info_provided", "Medium", "Citizen shared tip about location"),
            ("voice_call_completed", "Low", "AI voice call to reporter completed"),
        ]
        base_t = reported
        for i, (etype, pri, desc) in enumerate(random.sample(events_pool, k=random.randint(2, 5))):
            await db.alerts.insert_one({
                "id": str(uuid.uuid4()),
                "investigation_id": inv_id,
                "event_type": etype,
                "priority": pri,
                "description": desc,
                "action_required": "Review",
                "status": status,
                "timestamp": (base_t + timedelta(hours=i+1)).isoformat(),
                "read_by": [],
            })
        if status == "recovered":
            await db.alerts.insert_one({
                "id": str(uuid.uuid4()),
                "investigation_id": inv_id,
                "event_type": "person_recovered",
                "priority": "Critical",
                "description": f"{doc['person_name']} recovered safely",
                "action_required": "Close case",
                "status": "recovered",
                "timestamp": recovered_at,
                "read_by": [],
            })

    return {"ok": True, "seeded_investigations": len(inv_ids)}

# Startup and Shutdown Lifecycle Hooks
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup():
    try:
        # Check and Seed DB
        count = await investigations_col.count_documents({})
        if count == 0:
            await seed_data()
            logger.info("Auto-seeded database successfully")
    except Exception as e:
        logger.exception("Data seeding failed: %s", e)

@app.on_event("shutdown")
async def shutdown():
    client.close()
