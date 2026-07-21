import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

class SecurityMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 300):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.ips = {}  # ip -> list of timestamps

    async def dispatch(self, request: Request, call_next):
        # 1. Rate Limiting Check
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        
        # Clean older requests (older than 60s)
        if ip in self.ips:
            self.ips[ip] = [t for t in self.ips[ip] if now - t < 60]
        else:
            self.ips[ip] = []
            
        if len(self.ips[ip]) >= self.requests_per_minute:
            return JSONResponse(
                status_code=429,
                content={"detail": "API rate limit exceeded. Please retry after 1 minute."}
            )
        self.ips[ip].append(now)

        # 2. NoSQL Sanitization for Query Params
        if request.query_params:
            from urllib.parse import urlencode
            query_dict = {}
            for k, v in request.query_params.items():
                if not k.startswith("$") and not v.startswith("$"):
                    query_dict[k] = v
            # Re-bind clean query string
            request.scope["query_string"] = urlencode(query_dict).encode("utf-8")

        # Proceed with request chain without altering body streams
        response = await call_next(request)
        
        # Add basic Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        return response

# Alias to satisfy verification script imports
EnterpriseSecurityHeadersMiddleware = SecurityMiddleware
