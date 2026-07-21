import os
import uuid
from pathlib import Path
from app.config import UPLOADS_DIR

def secure_name(filename: str) -> str:
    # Simple characters sanitizer with uuid to prevent file name collision
    clean_base = "".join(c for c in filename if c.isalnum() or c in (".", "-", "_")).strip()
    if not clean_base:
        clean_base = "file"
    return f"{uuid.uuid4().hex}_{clean_base}"

def get_upload_path(category: str, filename: str) -> Path:
    # categories: photos, evidence, videos, cctv, detected_frames, rag_docs
    target_dir = UPLOADS_DIR / category
    os.makedirs(target_dir, exist_ok=True)
    clean = secure_name(filename)
    return target_dir / clean

def get_url_path(category: str, filename: str) -> str:
    # Expose upload assets relative URLs
    return f"/uploads/{category}/{filename}"
