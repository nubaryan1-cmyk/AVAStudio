from fastapi import APIRouter, Depends, HTTPException
from services.authn import get_current_user, AuthResult
from services.job_core import get_job_core
from services.schema_validator import validate_payload

router = APIRouter(prefix="/api/v1/lora")

@router.post("/train")
async def train_lora(request: dict, user: AuthResult = Depends(get_current_user)):
    if user.plan == "FREE": raise HTTPException(status_code=403, detail="PRO plan required")
    errors = validate_payload("lora.train", request)
    if errors: raise HTTPException(status_code=400, detail=errors)
    job, is_new = get_job_core().create_job("lora.train", request, user_id=user.user_id)
    return {"job_id": job.job_id, "is_new": is_new}

@router.get("/jobs/{job_id}")
async def get_lora_job(job_id: str, user: AuthResult = Depends(get_current_user)):
    job = get_job_core().get_job(job_id)
    if not job or job.user_id != user.user_id: raise HTTPException(status_code=403)
    return job