import os
import sys

import jwt
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.authn import get_current_user
from services import config as config_module


def _reset_config():
    config_module._config = None


def _build_client():
    app = FastAPI()

    @app.get("/protected")
    async def protected(user=Depends(get_current_user)):
        return {"user_id": user.user_id}

    return TestClient(app)


def _setup_env():
    os.environ["AVA_ENV"] = "STAGING"
    os.environ["SUPABASE_JWT_SECRET"] = "test-secret"
    os.environ.pop("SUPABASE_JWT_AUD", None)
    _reset_config()


def test_protected_route_requires_token():
    _setup_env()
    client = _build_client()

    response = client.get("/protected")

    assert response.status_code == 401


def test_protected_route_rejects_invalid_token():
    _setup_env()
    client = _build_client()

    response = client.get(
        "/protected",
        headers={"Authorization": "Bearer invalid.token.here"},
    )

    assert response.status_code == 401


def test_protected_route_accepts_valid_token():
    _setup_env()
    client = _build_client()

    token = jwt.encode(
        {
            "sub": "user-123",
            "role": "admin",
            "plan": "PRO",
            "email": "user@example.com",
        },
        "test-secret",
        algorithm="HS256",
    )

    response = client.get(
        "/protected",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["user_id"] == "user-123"
