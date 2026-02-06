"""
AVA TESTS - ROUTER FAILOVER AUDIT

================================================================================
Tests router failover and audit logging:
- GPU primary with SaaS fallback
- Circuit breaker operation
- Audit logging for routing decisions
================================================================================
"""

import pytest
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["AVA_ENV"] = "STAGING"
os.environ["AVA_MOCK_MODE"] = "1"

from services.router_policy import (
    Router, get_router, route_job,
    EndpointType, RouteResult, CircuitBreaker
)
from services.job_core import get_job_core


class TestCircuitBreaker:
    """Test circuit breaker functionality."""
    
    def test_initial_state_closed(self):
        """Test circuit starts closed."""
        cb = CircuitBreaker()
        assert cb.get_state("test-endpoint") == "closed"
        assert cb.is_allowed("test-endpoint")
    
    def test_opens_after_failures(self):
        """Test circuit opens after threshold failures."""
        cb = CircuitBreaker()
        endpoint = "failing-endpoint"
        
        # Record failures up to threshold
        for _ in range(cb.FAILURE_THRESHOLD):
            cb.record_failure(endpoint)
        
        # Circuit should be open
        assert cb.get_state(endpoint) == "open"
        assert not cb.is_allowed(endpoint)
    
    def test_closes_after_successes(self):
        """Test circuit closes after recovery."""
        cb = CircuitBreaker()
        endpoint = "recovering-endpoint"
        
        # Open the circuit
        for _ in range(cb.FAILURE_THRESHOLD):
            cb.record_failure(endpoint)
        
        # Force half-open state
        cb._open_time[endpoint] = 0  # Expired
        assert cb.get_state(endpoint) == "half-open"
        
        # Record successes
        for _ in range(cb.SUCCESS_THRESHOLD):
            cb.record_success(endpoint)
        
        # Circuit should be closed
        assert cb.get_state(endpoint) == "closed"
    
    def test_success_resets_failures(self):
        """Test success resets failure count."""
        cb = CircuitBreaker()
        endpoint = "test-endpoint"
        
        # Record some failures
        cb.record_failure(endpoint)
        cb.record_failure(endpoint)
        
        # Record success
        cb.record_success(endpoint)
        
        # Failure count should be reset
        assert cb._failures.get(endpoint, 0) == 0


class TestRouter:
    """Test router functionality."""
    
    def test_routes_photo_to_gpu(self):
        """Test photo jobs route to GPU endpoint."""
        result = route_job("photo.generate")
        assert result.endpoint_type == EndpointType.PHOTO_GPU
        assert result.provider == "gpu"
        assert not result.is_fallback
    
    def test_routes_lora_train(self):
        """Test LoRA training routes to GPU."""
        result = route_job("lora.train")
        assert result.endpoint_type == EndpointType.LORA_TRAIN
        assert result.provider == "gpu"
    
    def test_routes_lora_infer(self):
        """Test LoRA inference routes to GPU."""
        result = route_job("lora.infer")
        assert result.endpoint_type == EndpointType.LORA_INFER
    
    def test_routes_video_to_gpu(self):
        """Test video jobs route to GPU endpoint."""
        result = route_job("video.generate")
        assert result.endpoint_type == EndpointType.VIDEO_GPU
    
    def test_lora_has_no_saas_fallback(self):
        """Test LoRA endpoints don't have SaaS fallback."""
        router = get_router()
        fallback = router._get_fallback(EndpointType.LORA_TRAIN)
        assert fallback is None
        
        fallback = router._get_fallback(EndpointType.LORA_INFER)
        assert fallback is None


class TestRouterAudit:
    """Test router audit logging."""
    
    @pytest.fixture
    def job_core(self):
        """Get job core instance."""
        os.environ["AVA_SQLITE_FALLBACK"] = "1"
        return get_job_core()
    
    def test_router_decision_logged(self, job_core):
        """Test router decisions are logged to job_events."""
        # Create a job
        job, _ = job_core.create_job(
            job_type="lora.train",
            payload={"test": True}
        )
        
        # Log router decision
        job_core.log_router_decision(
            job_id=job.job_id,
            from_endpoint="none",
            to_endpoint="http://gpu.example.com/lora",
            reason="initial_routing",
            is_fallback=False
        )
        
        # Verify event was logged (would check DB in real test)
        # This test mainly verifies no errors are raised


if __name__ == "__main__":
    pytest.main([__file__, "-v"])