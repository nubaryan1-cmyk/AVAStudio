from fastapi import APIRouter, Depends
from services.authn import get_current_user

router = APIRouter(prefix="/internal/metrics", dependencies=[Depends(get_current_user)])

@router.get("/status")
def get_status():
    return {"system": "ok"}