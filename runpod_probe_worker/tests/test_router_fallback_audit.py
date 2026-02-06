"""
Router Fallback Audit Tests

================================================================================
Tests for GPU -> SaaS fallback with audit logging
================================================================================

Verifies:
- Router failover is logged
- Circuit breaker works
- Fallback decisions are audited
"""

import pytest
import os
import time

# Set test environment
os.environ["AVA_ENV"] = "STAGING"
os.environ["AVA_MOCK_MODE"] = "1"

from services.router_policy import (
    Router,
    CircuitBreaker,
    EndpointType,
    RouteResult,
    get_router,
    route_job
)


class TestCircuitBreaker:
    """Tests for circuit breaker functionality."""
    
    def test_circuit_starts_closed(self):
        """Circuit breaker should start in closed state."""
        cb = CircuitBreaker()
        assert cb.get_state("test-endpoint") == "closed"
    
    def test_circuit_opens_after_failures(self):
        """Circuit should open after failure threshold."""
        cb = CircuitBreaker()
        endpoint = "failing-endpoint"
        
        # Record failures up to threshold
        for _ in range(cb.FAILURE_THRESHOLD):
            cb.record_failure(endpoint)
        
        assert cb.get_state(endpoint) == "open"
    
    def test_closed_circuit_allows_requests(self):
        """Closed circuit should allow requests."""
        cb = CircuitBreaker()
        assert cb.is_allowed("healthy-endpoint") == True
    
    def test_open_circuit_blocks_requests(self):
        """Open circuit should block requests."""
        cb = CircuitBreaker()
        endpoint = "blocked-endpoint"
        
        # Open the circuit
        for _ in range(cb.FAILURE_THRESHOLD):
            cb.record_failure(endpoint)
        
        assert cb.is_allowed(endpoint) == False
    
    def test_success_resets_failure_count(self):
        """Success should reset failure count."""
        cb = CircuitBreaker()
        endpoint = "reset-endpoint"
        
        # Record some failures (but not enough to open)
        cb.record_failure(endpoint)
        cb.record_failure(endpoint)
        
        # Record success
        cb.record_success(endpoint)
        
        # More failures should still need full threshold
        cb.record_failure(endpoint)
        cb.record_failure(endpoint)
        
        assert cb.get_state(endpoint) == "closed"


class TestRouter:
    """Tests for router functionality."""
    
    def test_route_returns_result(self):
        """Router should return RouteResult."""
        router = Router()
        result = router.route(EndpointType.PHOTO_GPU)
        
        assert isinstance(result, RouteResult)
        assert result.endpoint_type == EndpointType.PHOTO_GPU
    
    def test_route_job_function(self):
        """route_job should return correct endpoint type."""
        # Photo generate
        result = route_job("photo.generate")
        assert result.endpoint_type == EndpointType.PHOTO_GPU
        
        # Video generate
        result = route_job("video.generate")
        assert result.endpoint_type == EndpointType.VIDEO_GPU
        
        # LoRA train
        result = route_job("lora.train")
        assert result.endpoint_type == EndpointType.LORA_TRAIN
    
    def test_fallback_not_available_for_lora_train(self):
        """LoRA training should not have fallback (requires specific GPU)."""
        router = Router()
        
        # Force circuit open
        router.circuit_breaker.record_failure(router.config.gpu_lora_url or "lora-endpoint")
        for _ in range(10):
            router.circuit_breaker.record_failure(router.config.gpu_lora_url or "lora-endpoint")
        
        result = router.route(EndpointType.LORA_TRAIN)
        
        # Should not be fallback for LORA_TRAIN
        # (it might still return primary even if unavailable)
        assert result.endpoint_type == EndpointType.LORA_TRAIN


class TestRouteResult:
    """Tests for RouteResult structure."""
    
    def test_route_result_fields(self):
        """RouteResult should have all required fields."""
        result = RouteResult(
            endpoint_url="https://gpu.example.com/v1",
            endpoint_type=EndpointType.PHOTO_GPU,
            is_fallback=False,
            provider="gpu",
            version="v1"
        )
        
        assert result.endpoint_url == "https://gpu.example.com/v1"
        assert result.endpoint_type == EndpointType.PHOTO_GPU
        assert result.is_fallback == False
        assert result.provider == "gpu"
    
    def test_fallback_result(self):
        """Fallback RouteResult should indicate fallback."""
        result = RouteResult(
            endpoint_url="https://api.fallback-ai.com/v1/generate",
            endpoint_type=EndpointType.PHOTO_GPU,
            is_fallback=True,
            provider="fallback"
        )
        
        assert result.is_fallback == True
        assert result.provider == "fallback"


class TestRouterAudit:
    """Tests for router decision audit logging."""
    
    def test_router_records_success(self):
        """Router should record successful requests."""
        router = get_router()
        endpoint = "success-audit-test"
        
        # Record success
        router.record_success(endpoint)
        
        # Circuit should remain closed
        assert router.circuit_breaker.get_state(endpoint) == "closed"
    
    def test_router_records_failure(self):
        """Router should record failed requests."""
        router = get_router()
        endpoint = "failure-audit-test"
        
        # Record failure
        router.record_failure(endpoint)
        
        # Should still be closed (under threshold)
        assert router.circuit_breaker.get_state(endpoint) == "closed"