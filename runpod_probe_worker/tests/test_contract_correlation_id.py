"""
Correlation ID Tests

Tests that correlation_id is properly handled in job records.
"""

import sys
import os
import pytest
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.observability import (
    generate_correlation_id,
    get_correlation_id,
    set_correlation_id,
    correlation_context
)
from services.ssot_invariants import CANON_CONTRACT_ROOT_FIELDS


class TestCorrelationId:
    """Tests for correlation_id handling."""
    
    def test_generate_correlation_id_is_uuid(self):
        """generate_correlation_id returns valid UUID."""
        cid = generate_correlation_id()
        # Should be valid UUID string
        uuid.UUID(cid)  # Raises if invalid
        assert len(cid) == 36
    
    def test_correlation_id_context_manager(self):
        """correlation_context sets and clears ID."""
        test_id = "test-correlation-123"
        
        with correlation_context(test_id):
            assert get_correlation_id() == test_id
        
        # After context, should be cleared
        assert get_correlation_id() is None
    
    def test_correlation_id_auto_generate(self):
        """correlation_context generates ID if not provided."""
        with correlation_context() as cid:
            assert cid is not None
            assert get_correlation_id() == cid
            uuid.UUID(cid)  # Validate it's a UUID
    
    def test_nested_correlation_context(self):
        """Nested contexts restore outer ID."""
        outer_id = "outer-123"
        inner_id = "inner-456"
        
        with correlation_context(outer_id):
            assert get_correlation_id() == outer_id
            
            with correlation_context(inner_id):
                assert get_correlation_id() == inner_id
            
            # Should restore outer
            assert get_correlation_id() == outer_id
    
    def test_set_and_get_correlation_id(self):
        """Can manually set and get correlation_id."""
        test_id = "manual-test-id"
        set_correlation_id(test_id)
        assert get_correlation_id() == test_id


class TestContractIncludesCorrelationId:
    """Tests that job contract includes correlation_id."""
    
    def test_correlation_id_in_contract_fields(self):
        """correlation_id is in CANON_CONTRACT_ROOT_FIELDS."""
        assert "correlation_id" in CANON_CONTRACT_ROOT_FIELDS
    
    def test_contract_fields_complete(self):
        """Contract has all required root fields."""
        expected_fields = {
            "job_id", "job_type", "state", "ssot_version",
            "correlation_id", "user_id",
            "timestamps", "payload", "progress", "result"
        }
        assert expected_fields == set(CANON_CONTRACT_ROOT_FIELDS)


class TestJobRecordCorrelationId:
    """Tests that job records include correlation_id."""
    
    def test_create_job_includes_correlation_id(self):
        """Job created via handler has correlation_id."""
        # Import handler's create function
        try:
            from handler import create_canonical_job
        except ImportError:
            pytest.skip("handler not importable")
        
        job = create_canonical_job(
            "test-job-1",
            "photo.generate",
            {},
            correlation_id="test-corr-id"
        )
        
        assert "correlation_id" in job
        assert job["correlation_id"] == "test-corr-id"
    
    def test_create_job_generates_correlation_id(self):
        """Job without correlation_id gets one generated."""
        try:
            from handler import create_canonical_job
        except ImportError:
            pytest.skip("handler not importable")
        
        job = create_canonical_job(
            "test-job-2",
            "photo.generate",
            {}
        )
        
        assert "correlation_id" in job
        assert job["correlation_id"] is not None
        # Should be valid UUID
        uuid.UUID(job["correlation_id"])


if __name__ == "__main__":
    pytest.main([__file__, "-v"])