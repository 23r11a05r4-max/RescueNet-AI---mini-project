import os
from pathlib import Path
from dotenv import load_dotenv

# Path to the backend root directory (where .env lives)
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'rescuenet')
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
UPLOADS_DIR = ROOT_DIR / "uploads"

# Ensure uploads directories exist
os.makedirs(UPLOADS_DIR / "photos", exist_ok=True)
os.makedirs(UPLOADS_DIR / "evidence", exist_ok=True)
os.makedirs(UPLOADS_DIR / "videos", exist_ok=True)
os.makedirs(UPLOADS_DIR / "cctv", exist_ok=True)
os.makedirs(UPLOADS_DIR / "detected_frames", exist_ok=True)
os.makedirs(UPLOADS_DIR / "rag_docs", exist_ok=True)
