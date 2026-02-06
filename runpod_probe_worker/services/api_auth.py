from fastapi import Request, HTTPException

def require_api_key(request: Request):
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = auth.split(" ", 1)[1].strip()
    if token != request.app.state.API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")

    return True
