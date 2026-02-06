import os
from typing import Iterable

import requests
from fastapi import APIRouter, HTTPException, Request, Response


DOTNET_GATEWAY_URL = os.getenv("AVA_DOTNET_GATEWAY_URL", "").rstrip("/")

router = APIRouter(prefix="/api")


def _filtered_headers(headers: Iterable[tuple[str, str]]) -> dict[str, str]:
    ignored = {"host", "content-length"}
    return {k: v for k, v in headers if k.lower() not in ignored}


async def _proxy_request(request: Request, path: str) -> Response:
    if not DOTNET_GATEWAY_URL:
        raise HTTPException(status_code=503, detail="DOTNET gateway not configured")

    url = f"{DOTNET_GATEWAY_URL}{path}"
    headers = _filtered_headers(request.headers.items())
    body = await request.body()
    response = requests.request(
        request.method,
        url,
        headers=headers,
        params=request.query_params,
        data=body,
        timeout=30,
    )
    return Response(
        status_code=response.status_code,
        content=response.content,
        headers={k: v for k, v in response.headers.items() if k.lower() != "transfer-encoding"},
        media_type=response.headers.get("content-type"),
    )


@router.post("/storage/presign-upload")
async def storage_presign_upload(request: Request):
    return await _proxy_request(request, "/api/storage/presign-upload")


@router.get("/storage/presign-download")
async def storage_presign_download(request: Request):
    return await _proxy_request(request, "/api/storage/presign-download")


@router.post("/stripe/checkout")
async def stripe_checkout(request: Request):
    return await _proxy_request(request, "/api/stripe/checkout")


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    return await _proxy_request(request, "/api/stripe/webhook")


@router.get("/auth/debug/whoami")
async def auth_debug(request: Request):
    return await _proxy_request(request, "/api/auth/debug/whoami")


@router.get("/auth/claims")
async def auth_claims(request: Request):
    return await _proxy_request(request, "/api/auth/claims")


@router.get("/pro/ping")
async def pro_ping(request: Request):
    return await _proxy_request(request, "/api/pro/ping")
