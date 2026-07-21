import time
from fastapi import Request, HTTPException
from typing import Dict

# In-memory IP based request bucket tracking
ip_buckets: Dict[str, list] = {}
MAX_REQUESTS = 100
TIME_WINDOW_SEC = 60

async def rate_limiter_dependency(request: Request):
    """
    FastAPI security dependency to prevent denial-of-service and brute-force attempts.
    Allows up to 100 requests per minute per IP address.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    now = time.time()
    
    if client_ip not in ip_buckets:
        ip_buckets[client_ip] = []
        
    # Remove older requests outside of current sliding window
    ip_buckets[client_ip] = [t for t in ip_buckets[client_ip] if now - t < TIME_WINDOW_SEC]
    
    if len(ip_buckets[client_ip]) >= MAX_REQUESTS:
         raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")
         
    ip_buckets[client_ip].append(now)
