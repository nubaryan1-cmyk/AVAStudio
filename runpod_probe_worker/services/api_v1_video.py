from fastapi import APIRouter, Depends, HTTPException
from services.authn import get_current_user, AuthResult, require_role
from services.job_core import get_job_core
from services.rate_limit import limiter
from services.schema_validator import validate_payload

router = APIRouter(prefix="/api/v1/video")

@router.post("/generate")
@limiter.limit("20/minute")
async def generate_video(request: dict, user: AuthResult = Depends(get_current_user)):
    require_role(user, ["admin", "user"])
    errors = validate_payload("video.generate", request)
    if errors: 
        raise HTTPException(status_code=400, detail=errors)
    job, is_new = get_job_core().create_job("video.generate", request, user_id=user.user_id)
    return {"job_id": job.job_id, "is_new": is_new}

@router.get("/jobs/{job_id}")
@limiter.limit("60/minute")
async def get_video_job(job_id: str, user: AuthResult = Depends(get_current_user)):
    require_role(user, ["admin", "user", "viewer"])
    job = get_job_core().get_job(job_id)
    if not job or job.user_id != user.user_id: 
        raise HTTPException(status_code=403, detail="Forbidden")
    return job
