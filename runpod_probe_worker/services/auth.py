import os
from fastapi import Header, HTTPException

API_KEY = os.getenv("AVA_API_KEY", "").strip()

def require_bearer(authorization: str | None = Header(default=None)):
    # allow no-key mode for local dev if API_KEY is empty
    if not API_KEY:
        return True

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = authorization.split(" ", 1)[1].strip()
    if token != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid token")

    return True
