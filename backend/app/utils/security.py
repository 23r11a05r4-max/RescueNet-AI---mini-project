import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False

import html

def sanitize_text(val: str) -> str:
    """
    Sanitizes string inputs by escaping HTML characters to prevent XSS injection.
    """
    if not isinstance(val, str):
        return val
    return html.escape(val).strip()

def sanitize_payload(data):
    """
    Recursively sanitizes dictionary/list payloads.
    """
    if isinstance(data, dict):
        return {k: sanitize_payload(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_payload(v) for v in data]
    elif isinstance(data, str):
        return sanitize_text(data)
    return data
