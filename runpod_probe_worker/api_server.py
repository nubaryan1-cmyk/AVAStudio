import services.ssot_env_guard
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from services.authn import get_current_user
from services.api_v1_photo import router as photo_router
from services.api_v1_video import router as video_router
from services.api_v1_lora import router as lora_router
from services.api_ws import router as ws_router

# [WORLD-READY] docs, redoc Рё openapi РѕС‚РєР»СЋС‡РµРЅС‹ РїРѕР»РЅРѕСЃС‚СЊСЋ (P1-07)
app = FastAPI(
    docs_url=None, 
    redoc_url=None, 
    openapi_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://avastudio.ai"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(photo_router)
app.include_router(video_router)
app.include_router(lora_router)
app.include_router(ws_router)

@app.get("/health")
def health(): return {"status": "ok"}

@app.get("/metrics", dependencies=[Depends(get_current_user)])
def metrics(): return {"metrics": "secure"}

@app.get("/api/v1/flags", dependencies=[Depends(get_current_user)])
def flags(): return {"v2": True}