from motor.motor_asyncio import AsyncIOMotorClient
from app.config import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Collections helpers
users_col = db.users
investigations_col = db.investigations
alerts_col = db.alerts
ai_cache_col = db.ai_cache
chats_col = db.chats
rag_documents_col = db.rag_documents
audit_logs_col = db.audit_logs
