import json
import logging
from datetime import datetime, timezone

import services.ssot_env_guard
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from services.authn import AuthResult, get_current_user, require_role
from services.config import get_config
from services.rate_limit import limiter
from services.api_v1_photo import router as photo_router
from services.api_v1_video import router as video_router
from services.api_v1_lora import router as lora_router
from services.api_ws import router as ws_router
from services.api_gateway_proxy import router as gateway_proxy_router

# [WORLD-READY] docs, redoc Рё openapi РѕС‚РєР»СЋС‡РµРЅС‹ РїРѕР»РЅРѕСЃС‚СЊСЋ (P1-07)
app = FastAPI(
    docs_url=None, 
    redoc_url=None, 
    openapi_url=None
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

config = get_config()
if config.is_prod:
    cors_origins = ["https://avastudio.ai"]
else:
    cors_origins = ["https://staging.avastudio.ai"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(photo_router)
app.include_router(video_router)
app.include_router(lora_router)
app.include_router(ws_router)
app.include_router(gateway_proxy_router)

@app.get("/health")
def health(): return {"status": "ok"}

@app.get("/metrics")
@limiter.limit("10/minute")
def metrics(user: AuthResult = Depends(get_current_user)):
    require_role(user, ["admin"])
    return {"metrics": "secure"}

@app.get("/api/v1/flags")
@limiter.limit("30/minute")
def flags(user: AuthResult = Depends(get_current_user)):
    require_role(user, ["admin"])
    return {"v2": True}


@app.middleware("http")
async def audit_middleware(request: Request, call_next):
    start = datetime.now(timezone.utc)
    response = await call_next(request)
    audit_logger = logging.getLogger("audit")
    payload = {
        "ts": start.isoformat(),
        "method": request.method,
        "path": request.url.path,
        "status": response.status_code,
        "user_id": getattr(request.state, "user_id", None),
        "role": getattr(request.state, "role", None),
        "client": request.client.host if request.client else None,
    }
    audit_logger.info(json.dumps(payload))
    return response
