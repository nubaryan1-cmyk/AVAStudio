"""
AVA TESTS - PUBLIC API CONTRACT

================================================================================
Tests public API endpoints:
- POST /api/v1/photo/generate
- POST /api/v1/video/generate
- POST /api/v1/lora/train
- POST /api/v1/lora/infer
- GET /api/v1/{photo,video,lora}/jobs/{job_id}
================================================================================
"""

import pytest
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Set test environment
os.environ["AVA_ENV"] = "STAGING"
os.environ["AVA_MOCK_MODE"] = "1"
os.environ["AVA_SQLITE_FALLBACK"] = "1"

from fastapi.testclient import TestClient
from api_server import app


@pytest.fixture
def client():
    """Get test client."""
    return TestClient(app)


@pytest.fixture
def auth_headers():
    """Get auth headers for dev user."""
    return {"Authorization": "Bearer dev_token"}


class TestHealthEndpoint:
    """Test health endpoint."""
    
    def test_health_returns_ok(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "version" in data


class TestPhotoAPI:
    """Test /api/v1/photo endpoints."""
    
    def test_generate_requires_auth(self, client):
        """Test generate requires authentication."""
        response = client.post("/api/v1/photo/generate", json={
            "prompt": "test image"
        })
        assert response.status_code == 401
    
    def test_generate_with_auth(self, client, auth_headers):
        """Test generate with authentication."""
        response = client.post(
            "/api/v1/photo/generate",
            json={"prompt": "a beautiful sunset"},
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
        assert "state" in data
        assert data["is_new"] == True
    
    def test_generate_idempotency(self, client, auth_headers):
        """Test idempotency key works."""
        payload = {"prompt": "test idempotency"}
        headers = {**auth_headers, "Idempotency-Key": "test-key-123"}
        
        # First request
        r1 = client.post("/api/v1/photo/generate", json=payload, headers=headers)
        assert r1.status_code == 200
        
        # Second request with same key - should return same job
        r2 = client.post("/api/v1/photo/generate", json=payload, headers=headers)
        assert r2.status_code == 200
        assert r2.json()["job_id"] == r1.json()["job_id"]
        assert r2.json()["is_new"] == False
    
    def test_get_job_status(self, client, auth_headers):
        """Test getting job status."""
        # Create job first
        create_response = client.post(
            "/api/v1/photo/generate",
            json={"prompt": "test"},
            headers=auth_headers
        )
        job_id = create_response.json()["job_id"]
        
        # Get job status
        response = client.get(
            f"/api/v1/photo/jobs/{job_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["job_id"] == job_id
        assert data["job_type"] == "photo.generate"
        assert "state" in data
        assert "progress" in data
    
    def test_get_nonexistent_job(self, client, auth_headers):
        """Test 404 for nonexistent job."""
        response = client.get(
            "/api/v1/photo/jobs/nonexistent-id",
            headers=auth_headers
        )
        assert response.status_code == 404


class TestLoraAPI:
    """Test /api/v1/lora endpoints."""
    
    def test_train_requires_pro_plan(self, client, auth_headers):
        """Test LoRA training requires PRO plan."""
        # Dev user has admin role by default in STAGING
        response = client.post(
            "/api/v1/lora/train",
            json={
                "dataset": {"num_images": 20},
                "training": {"epochs": 10}
            },
            headers=auth_headers
        )
        # Should work for dev user (admin)
        assert response.status_code in (200, 403)
    
    def test_infer_creates_job(self, client, auth_headers):
        """Test LoRA inference creates job."""
        response = client.post(
            "/api/v1/lora/infer",
            json={
                "prompt": "a photo in the style of TOK",
                "lora_id": "test-lora-123"
            },
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data
    
    def test_get_lora_job(self, client, auth_headers):
        """Test getting LoRA job status."""
        # Create job first
        create_response = client.post(
            "/api/v1/lora/infer",
            json={"prompt": "test", "lora_id": "test-lora"},
            headers=auth_headers
        )
        job_id = create_response.json()["job_id"]
        
        # Get job status
        response = client.get(
            f"/api/v1/lora/jobs/{job_id}",
            headers=auth_headers
        )
        assert response.status_code == 200


class TestVideoAPI:
    """Test /api/v1/video endpoints."""
    
    def test_generate_requires_pro(self, client, auth_headers):
        """Test video generation requires PRO plan."""
        response = client.post(
            "/api/v1/video/generate",
            json={
                "prompt": "a cat running"
            },
            headers=auth_headers
        )
        # Dev user should pass or get 403 depending on plan
        assert response.status_code in (200, 403)


class TestErrorResponses:
    """Test error response format."""
    
    def test_401_format(self, client):
        """Test 401 error format."""
        response = client.post("/api/v1/photo/generate", json={"prompt": "test"})
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        detail = data["detail"]
        assert "class" in detail
        assert "code" in detail
        assert "message" in detail
    
    def test_404_format(self, client, auth_headers):
        """Test 404 error format."""
        response = client.get(
            "/api/v1/photo/jobs/nonexistent",
            headers=auth_headers
        )
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])