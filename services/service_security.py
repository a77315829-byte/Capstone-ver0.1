"""Internal API boundary shared by the exhibition services."""
import hmac
import os
from urllib.parse import unquote
from starlette.responses import JSONResponse
from starlette.concurrency import run_in_threadpool

def install_service_security(app, *, scenario_repository=None):
    @app.middleware("http")
    async def internal_boundary(request, call_next):
        if request.url.path in ("/", "/health"):
            return await call_next(request)
        secret = os.getenv("EXHIBITION_SERVICE_KEY", "")
        if not secret:
            return JSONResponse({"message": "Internal service key is not configured."}, status_code=503)
        supplied = request.headers.get("x-service-key", "")
        if not hmac.compare_digest(secret.encode(), supplied.encode()):
            return JSONResponse({"message": "Internal service authentication required."}, status_code=401)
        if scenario_repository and request.url.path.startswith("/api/"):
            username = unquote(request.headers.get("x-user-id", ""))
            if not username:
                return JSONResponse({"message": "Authenticated user required."}, status_code=401)
            parts = request.url.path.split("/")
            if len(parts) > 3 and parts[2] == "users" and parts[3] != username:
                return JSONResponse({"message": "Access denied."}, status_code=403)
            if len(parts) > 3 and parts[2] == "sessions":
                try:
                    session = await run_in_threadpool(lambda: scenario_repository().get_session(parts[3]))
                except LookupError:
                    return JSONResponse({"message": "Session not found."}, status_code=404)
                except Exception:
                    return JSONResponse({"message": "Database unavailable."}, status_code=503)
                if session.get("user_id") != username:
                    return JSONResponse({"message": "Access denied."}, status_code=403)
        return await call_next(request)
