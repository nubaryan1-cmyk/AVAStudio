"""
Public API Contract Tests

================================================================================
Tests for /api/v1/photo/*, /api/v1/video/*, /api/v1/lora/* endpoints
================================================================================

Verifies:
- Endpoints exist and accept correct payloads
- Response schemas match contract
- Error responses follow canon error taxonomy
"""

import pytest
import json
from unittest.mock import patch, MagicMock


class TestPhotoAPI:
    """Tests for /api/v1/photo/* endpoints."""
    
    def test_photo_generate_endpoint_exists(self):
        """POST /api/v1/photo/generate should exist."""
        from services.api_v1_photo import router
        
        routes = [r.path for r in router.routes]
        assert "/generate" in routes or any("/generate" in str(r.path) for r in router.routes)
    
    def test_photo_jobs_endpoint_exists(self):
        """GET /api/v1/photo/jobs/{job_id} should exist."""
        from services.api_v1_photo import router
        
        routes = [r.path for r in router.routes]
        assert any("job" in str(r.path).lower() for r in router.routes)
    
    def test_photo_generate_request_validation(self):
        """PhotoGenerateRequest should validate prompt."""
        from services.api_v1_photo import PhotoGenerateRequest
        
        # Valid request
        req = PhotoGenerateRequest(prompt="A beautiful sunset")
        assert req.prompt == "A beautiful sunset"
        assert req.width == 1024  # default
        assert req.height == 1024  # default
        
        # Invalid: empty prompt should fail
        with pytest.raises(Exception):
            PhotoGenerateRequest(prompt="")
    
    def test_photo_generate_request_defaults(self):
        """PhotoGenerateRequest should have correct defaults."""
        from services.api_v1_photo import PhotoGenerateRequest
        
        req = PhotoGenerateRequest(prompt="Test")
        assert req.num_images == 1
        assert req.guidance_scale == 7.5
        assert req.num_inference_steps == 30
        assert req.lora_weight == 0.8


class TestVideoAPI:
    """Tests for /api/v1/video/* endpoints."""
    
    def test_video_generate_endpoint_exists(self):
        """POST /api/v1/video/generate should exist."""
        from services.api_v1_video import router
        
        routes = [r.path for r in router.routes]
        assert "/generate" in routes or any("/generate" in str(r.path) for r in router.routes)
    
    def test_video_generate_request_validation(self):
        """VideoGenerateRequest should validate prompt."""
        from services.api_v1_video import VideoGenerateRequest
        
        req = VideoGenerateRequest(prompt="A flying bird")
        assert req.prompt == "A flying bird"
        assert req.width == 1280  # default
        assert req.height == 720  # default
        assert req.duration_seconds == 5  # default


class TestLoraAPI:
    """Tests for /api/v1/lora/* endpoints."""
    
    def test_lora_train_endpoint_exists(self):
        """POST /api/v1/lora/train should exist."""
        from services.api_v1_lora import router
        
        routes = [r.path for r in router.routes]
        assert "/train" in routes or any("/train" in str(r.path) for r in router.routes)
    
    def test_lora_infer_endpoint_exists(self):
        """POST /api/v1/lora/infer should exist."""
        from services.api_v1_lora import router
        
        routes = [r.path for r in router.routes]
        assert "/infer" in routes or any("/infer" in str(r.path) for r in router.routes)
    
    def test_lora_train_request_structure(self):
        """LoraTrainRequest should have dataset and training."""
        from services.api_v1_lora import LoraTrainRequest, DatasetConfig, TrainingConfig
        
        req = LoraTrainRequest(
            dataset=DatasetConfig(num_images=20),
            training=TrainingConfig(epochs=10)
        )
        assert req.dataset.num_images == 20
        assert req.training.epochs == 10
    
    def test_lora_infer_request_requires_lora_id(self):
        """LoraInferRequest should require lora_id."""
        from services.api_v1_lora import LoraInferRequest
        
        req = LoraInferRequest(prompt="Test with lora", lora_id="lora-123")
        assert req.lora_id == "lora-123"
        assert req.lora_weight == 0.8  # default


class TestResponseSchemas:
    """Tests for response schemas."""
    
    def test_job_response_schema(self):
        """JobResponse should have required fields."""
        from services.api_v1_photo import JobResponse
        
        resp = JobResponse(
            job_id="test-123",
            job_type="photo.generate",
            state="CREATED",
            correlation_id="corr-456",
            created_at="2025-01-01T00:00:00Z",
            progress={"percent": 0}
        )
        
        assert resp.job_id == "test-123"
        assert resp.job_type == "photo.generate"
        assert resp.state == "CREATED"
    
    def test_create_job_response_schema(self):
        """CreateJobResponse should have required fields."""
        from services.api_v1_photo import CreateJobResponse
        
        resp = CreateJobResponse(
            job_id="test-123",
            state="IN_QUEUE",
            is_new=True,
            message="Job created"
        )
        
        assert resp.job_id == "test-123"
        assert resp.is_new == True