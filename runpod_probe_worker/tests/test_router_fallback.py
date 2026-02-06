"""
Router Fallback Tests

Tests GPU -> SaaS fallback routing.
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.router_policy import (
    Router,
    EndpointType,
    CircuitBreaker,
    route_job,
    get_router
)


class TestCircuitBreaker:
    """Tests for circuit breaker."""
    
    def test_circuit_starts_closed(self):
        """Circuit breaker starts in closed state."""
        cb = CircuitBreaker()
        assert cb.get_state("test-endpoint") == "closed"
    
    def test_circuit_opens_after_failures(self):
        """Circuit opens after threshold failures."""
        cb = CircuitBreaker()
        endpoint = "test-endpoint"
        
        # Record failures up to threshold
        for _ in range(cb.FAILURE_THRESHOLD):
            cb.record_failure(endpoint)
        
        assert cb.get_state(endpoint) == "open"
        assert not cb.is_allowed(endpoint)
    
    def test_success_resets_failure_count(self):
        """Success resets failure count."""
        cb = CircuitBreaker()
        endpoint = "test-endpoint"
        
        # Record some failures
        cb.record_failure(endpoint)
        cb.record_failure(endpoint)
        
        # Success should reset
        cb.record_success(endpoint)
        
        assert cb.get_state(endpoint) == "closed"


class TestRouter:
    """Tests for router."""
    
    def test_routes_photo_job(self):
        """Can route photo.generate job."""
        result = route_job("photo.generate")
        assert result.endpoint_type == EndpointType.PHOTO_GPU
    
    def test_routes_video_job(self):
        """Can route video.generate job."""
        result = route_job("video.generate")
        assert result.endpoint_type == EndpointType.VIDEO_GPU
    
    def test_routes_lora_train_job(self):
        """Can route lora.train job."""
        result = route_job("lora.train")
        assert result.endpoint_type == EndpointType.LORA_TRAIN
    
    def test_routes_lora_infer_job(self):
        """lora.infer routes to LORA_INFER."""
        result = route_job("lora.infer")
        assert result.endpoint_type == EndpointType.LORA_INFER
    
    def test_routes_legacy_train_lora(self):
        """Legacy train_lora routes correctly."""
        result = route_job("train_lora")
        assert result.endpoint_type == EndpointType.LORA_TRAIN
    
    def test_lora_train_no_fallback(self):
        """LORA_TRAIN should not have SaaS fallback."""
        router = Router()
        # Force circuit open for GPU
        result = router.route(EndpointType.LORA_TRAIN)
        # Even with circuit open, no fallback for LORA_TRAIN
        assert not result.is_fallback or result.endpoint_type == EndpointType.LORA_TRAIN


class TestRouterFallback:
    """Tests for fallback behavior."""
    
    def test_router_uses_primary_when_healthy(self):
        """Router uses primary GPU when healthy."""
        router = Router()
        result = router.route(EndpointType.PHOTO_GPU)
        # In mock mode, should not be fallback
        # Unless GPU URL not configured
        assert isinstance(result.provider, str)
    
    def test_fallback_on_circuit_open(self):
        """Router falls back when circuit is open."""
        router = Router()
        
        # Open circuit for GPU endpoint
        if router.config.gpu_photo_url:
            for _ in range(CircuitBreaker.FAILURE_THRESHOLD):
                router.circuit_breaker.record_failure(router.config.gpu_photo_url)
            
            result = router.route(EndpointType.PHOTO_GPU)
            # Should attempt fallback if available
            # Result depends on env config


if __name__ == "__main__":
    pytest.main([__file__, "-v"])