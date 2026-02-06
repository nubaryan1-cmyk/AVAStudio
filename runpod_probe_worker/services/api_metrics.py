from fastapi import APIRouter, Depends
from services.authn import AuthResult, get_current_user, require_role
from services.rate_limit import limiter

router = APIRouter(prefix="/internal/metrics")

@router.get("/status")
@limiter.limit("10/minute")
def get_status(user: AuthResult = Depends(get_current_user)):
    require_role(user, ["admin"])
    return {"system": "ok"}
