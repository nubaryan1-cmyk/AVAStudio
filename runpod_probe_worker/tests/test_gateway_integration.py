import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["AVA_ENV"] = "STAGING"
os.environ["AVA_MOCK_MODE"] = "1"
os.environ["AVA_SQLITE_FALLBACK"] = "1"

try:
    import slowapi  # noqa: F401
    _HAS_SLOWAPI = True
except Exception:
    _HAS_SLOWAPI = False


@pytest.mark.skipif(not _HAS_SLOWAPI, reason="slowapi dependency not available")
def test_api_v1_flags_returns_ok():
    from api_server import app

    client = TestClient(app)

    response = client.get("/api/v1/flags", headers={"Authorization": "Bearer dev_token"})

    assert response.status_code == 200
    assert response.json() == {"v2": True}
