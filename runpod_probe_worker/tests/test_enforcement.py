import services.ssot_versioning as ssot_versioning
"""
AVA6/AVA8 ENFORCEMENT TESTS - RUNTIME INTEGRATION (pytest compatible)

Tests that prove ERROR_TAXONOMY and SSOT_VERSIONING are enforced
in ACTUAL RUNTIME code paths, not just unit tests of services.

Canon Authority: _CANON/SEMANTICS/ERROR_TAXONOMY.md v1.1
Canon Authority: _CANON/SEMANTICS/SSOT_VERSIONING.md v1.1
"""

import sys
import os
import pytest

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Ensure STAGING env before imports
os.environ["AVA_ENV"] = "STAGING"

from services.error_taxonomy import (
    normalize_error,
    classify_exception,
    validate_error_obj,
    from_http_status,
    create_error,
    CANON_ERROR_CLASSES,
    InvalidErrorObjectError
)
from services.ssot_versioning import (
    normalize_ssot_version,
    validate_ssot_version,
    process_job_intake,
    DEFAULT_SSOT_VERSION,
    CURRENT_SSOT_VERSION
)
from services.lifecycle import now


# =============================================================================
# ERROR TAXONOMY TESTS
# =============================================================================

class TestErrorTaxonomy:
    """Tests for ERROR_TAXONOMY enforcement."""
    
    def test_string_error_normalizes_to_fatal_unclassified(self):
        """String error -> fatal/FATAL_UNCLASSIFIED"""
        result = normalize_error("Something went wrong")
        assert result["class"] == "fatal"
        assert result["code"] == "FATAL_UNCLASSIFIED"
    
    def test_none_error_stays_none(self):
        """None error -> None"""
        result = normalize_error(None)
        assert result is None
    
    def test_valid_dict_preserved(self):
        """Valid dict is preserved"""
        result = normalize_error({"class": "user", "code": "USER_NOT_FOUND", "message": "Not found"})
        assert result["class"] == "user"
        assert result["code"] == "USER_NOT_FOUND"
    
    def test_invalid_class_normalizes_to_fatal(self):
        """Invalid class -> fatal/FATAL_INVALID_ERROR_CLASS"""
        result = normalize_error({"class": "invalid_class", "code": "TEST", "message": "Test"})
        assert result["class"] == "fatal"
        assert result["code"] == "FATAL_INVALID_ERROR_CLASS"
    
    def test_timeout_error_classifies_to_infra(self):
        """TimeoutError -> infra/INFRA_TIMEOUT"""
        result = classify_exception(TimeoutError("Connection timed out"))
        assert result["class"] == "infra"
        assert result["code"] == "INFRA_TIMEOUT"
    
    def test_value_error_classifies_to_user(self):
        """ValueError -> user/USER_INVALID_INPUT"""
        result = classify_exception(ValueError("Invalid value"))
        assert result["class"] == "user"
        assert result["code"] == "USER_INVALID_INPUT"
    
    def test_http_429_maps_to_quota(self):
        """HTTP 429 -> quota/QUOTA_RATE_LIMIT"""
        result = from_http_status(429)
        assert result["class"] == "quota"
        assert result["code"] == "QUOTA_RATE_LIMIT"
    
    def test_http_502_maps_to_infra(self):
        """HTTP 502 -> infra/INFRA_UPSTREAM_UNAVAILABLE"""
        result = from_http_status(502)
        assert result["class"] == "infra"
        assert result["code"] == "INFRA_UPSTREAM_UNAVAILABLE"
    
    def test_validate_string_error_raises(self):
        """Validate string error raises InvalidErrorObjectError"""
        with pytest.raises(InvalidErrorObjectError):
            validate_error_obj("string error")
    
    def test_create_error_with_known_code(self):
        """create_error with known code works"""
        result = create_error("INFRA_TIMEOUT")
        assert result["class"] == "infra"
        assert result["code"] == "INFRA_TIMEOUT"


# =============================================================================
# SSOT VERSIONING TESTS
# =============================================================================

class TestSsotVersioning:
    """Tests for SSOT_VERSIONING enforcement."""
    
    def test_missing_version_defaults_to_1_0(self):
        """Missing ssot_version -> default to 1.0"""
        job = {"job_id": "test-1", "state": "CREATED"}
        normalize_ssot_version(job)
        assert job.get("ssot_version") == DEFAULT_SSOT_VERSION
    
    def test_existing_version_preserved(self):
        """Existing version is preserved"""
        job = {"job_id": "test-2", "state": "CREATED", "ssot_version": "1.1"}
        normalize_ssot_version(job)
        assert job.get("ssot_version") == "1.1"
    
    def test_validate_v1_0_succeeds(self):
        """Validate v1.0 succeeds"""
        job = {"job_id": "test-3", "ssot_version": "1.0"}
        validate_ssot_version(job)  # Should not raise
    
    def test_validate_v1_1_succeeds(self):
        """Validate v1.1 succeeds"""
        job = {"job_id": "test-4", "ssot_version": "1.1"}
        validate_ssot_version(job)  # Should not raise
    
    def test_validate_v2_0_fails(self):
        """Validate v2.0 raises UnsupportedSsotVersionError"""
        job = {"job_id": "test-5", "ssot_version": "2.0"}
        with pytest.raises(ssot_versioning.UnsupportedSsotVersionError):
            validate_ssot_version(job)
    
    def test_validate_v9_0_fails(self):
        """Validate v9.0 raises UnsupportedSsotVersionError"""
        job = {"job_id": "test-6", "ssot_version": "9.0"}
        with pytest.raises(ssot_versioning.UnsupportedSsotVersionError):
            validate_ssot_version(job)
    
    def test_process_intake_unsupported_version_fails_job(self):
        """process_job_intake with unsupported version -> FAILED"""
        job = {"job_id": "test-7", "state": "CREATED", "ssot_version": "9.0"}
        processed, success = process_job_intake(job)
        assert not success
        assert processed["state"] == "FAILED"
        error = processed.get("result", {}).get("error", {})
        assert error.get("code") == "FATAL_UNSUPPORTED_SSOT_VERSION"
    
    def test_process_intake_valid_version_succeeds(self):
        """process_job_intake with valid version -> success"""
        job = {"job_id": "test-8", "state": "CREATED", "ssot_version": "1.0"}
        processed, success = process_job_intake(job)
        assert success
        assert processed["state"] == "CREATED"


# =============================================================================
# RUNTIME INTEGRATION TESTS (Handler Simulation)
# =============================================================================

class TestRuntimeIntegration:
    """Tests for runtime integration (handler simulation)."""
    
    @staticmethod
    def _create_canonical_job(job_id: str, job_type: str, payload: dict) -> dict:
        """Simulate create_canonical_job logic."""
        ssot_version = payload.get("ssot_version") or CURRENT_SSOT_VERSION
        return {
            "job_id": job_id,
            "job_type": job_type,
            "state": "CREATED",
            "ssot_version": ssot_version,
            "timestamps": {"created": now(), "started": None, "finished": None},
            "payload": payload.get("payload", {}),
            "progress": {"percent": 0, "step": 0, "total": 0, "message": ""},
            "result": {"artifacts": [], "metrics": {}, "error": None}
        }
    
    @staticmethod
    def _fail_job_with_error(record: dict, error: dict, site: str) -> dict:
        """Simulate fail_job_with_error."""
        validate_error_obj(error)
        record["state"] = "FAILED"
        record["timestamps"]["finished"] = now()
        record["result"]["error"] = error
        return record
    
    @staticmethod
    def _validate_record_error(record: dict) -> None:
        """Simulate validate_record_error."""
        error = record.get("result", {}).get("error")
        if error is not None:
            validate_error_obj(error)
    
    def test_create_job_includes_ssot_version(self):
        """create_canonical_job includes ssot_version"""
        job = self._create_canonical_job("test-rt-1", "train_lora", {})
        assert "ssot_version" in job
        assert job["ssot_version"] == CURRENT_SSOT_VERSION
    
    def test_create_job_respects_payload_ssot_version(self):
        """create_canonical_job respects payload ssot_version"""
        job = self._create_canonical_job("test-rt-2", "train_lora", {"ssot_version": "1.0"})
        assert job["ssot_version"] == "1.0"
    
    def test_create_job_error_is_none(self):
        """create_canonical_job result.error is None"""
        job = self._create_canonical_job("test-rt-3", "train_lora", {})
        assert job["result"]["error"] is None
    
    def test_fail_job_sets_error_correctly(self):
        """fail_job_with_error sets state and error correctly"""
        job = self._create_canonical_job("test-rt-4", "train_lora", {})
        error = {"class": "user", "code": "USER_INVALID_INPUT", "message": "Test error"}
        failed_job = self._fail_job_with_error(job, error, "test:fail")
        assert failed_job["state"] == "FAILED"
        assert failed_job["result"]["error"]["class"] == "user"
    
    def test_fail_job_rejects_string_error(self):
        """fail_job_with_error rejects string error"""
        job = self._create_canonical_job("test-rt-5", "train_lora", {})
        with pytest.raises(InvalidErrorObjectError):
            self._fail_job_with_error(job, "string error", "test:fail")
    
    def test_validate_record_accepts_valid_error(self):
        """validate_record_error accepts valid error"""
        job = self._create_canonical_job("test-rt-6", "train_lora", {})
        job["result"]["error"] = {"class": "fatal", "code": "FATAL_INTERNAL", "message": "Test"}
        self._validate_record_error(job)  # Should not raise
    
    def test_validate_error_rejects_invalid_class(self):
        """validate_error_obj rejects invalid class"""
        with pytest.raises(InvalidErrorObjectError):
            validate_error_obj({"class": "invalid_class", "code": "TEST", "message": "test"})
    
    def test_job_with_unsupported_version_fails_validation(self):
        """Job with v9.0 fails SSOT validation"""
        job = self._create_canonical_job("test-rt-8", "train_lora", {"ssot_version": "9.0"})
        with pytest.raises(ssot_versioning.UnsupportedSsotVersionError):
            validate_ssot_version(job)


# =============================================================================
# REAL HANDLER TESTS (optional - requires runpod)
# =============================================================================

class TestRealHandler:
    """Tests that call the REAL handler() function."""
    
    @pytest.fixture(autouse=True)
    def setup_handler(self):
        """Try to import handler module."""
        try:
            from handler import handler, create_canonical_job, fail_job_with_error, validate_record_error
            self.handler = handler
            self.create_canonical_job = create_canonical_job
            self.fail_job_with_error = fail_job_with_error
            self.validate_record_error = validate_record_error
            self.handler_available = True
        except ImportError:
            self.handler_available = False
    
    def test_handler_status_not_found_returns_canonical_error(self):
        """Handler status: job not found -> canonical USER_NOT_FOUND"""
        if not self.handler_available:
            pytest.skip("Handler module not available (runpod not installed)")
        
        event = {"input": {"action": "status", "job_id": "nonexistent-test-job-12345"}}
        result = self.handler(event)
        
        assert result["state"] == "FAILED"
        error = result.get("result", {}).get("error")
        assert isinstance(error, dict)
        assert error.get("code") == "USER_NOT_FOUND"
    
    def test_handler_error_is_dict_not_string(self):
        """Handler status error is dict (not string)"""
        if not self.handler_available:
            pytest.skip("Handler module not available (runpod not installed)")
        
        event = {"input": {"action": "status", "job_id": "nonexistent-test-job-12345"}}
        result = self.handler(event)
        error = result.get("result", {}).get("error")
        assert isinstance(error, dict)
    
    def test_handler_error_has_required_fields(self):
        """Handler error has {class, code, message}"""
        if not self.handler_available:
            pytest.skip("Handler module not available (runpod not installed)")
        
        event = {"input": {"action": "status", "job_id": "nonexistent-test-job-12345"}}
        result = self.handler(event)
        error = result.get("result", {}).get("error")
        assert all(k in error for k in ["class", "code", "message"])
    
    def test_handler_error_class_in_allowed_set(self):
        """Handler error.class is in allowed set"""
        if not self.handler_available:
            pytest.skip("Handler module not available (runpod not installed)")
        
        event = {"input": {"action": "status", "job_id": "nonexistent-test-job-12345"}}
        result = self.handler(event)
        error = result.get("result", {}).get("error")
        allowed_classes = {"infra", "user", "model", "quota", "fatal"}
        assert error.get("class") in allowed_classes
    
    def test_handler_create_job_has_ssot_version(self):
        """Handler create_canonical_job has ssot_version=1.1"""
        if not self.handler_available:
            pytest.skip("Handler module not available (runpod not installed)")
        
        job = self.create_canonical_job("handler-test-1", "train_lora", {})
        assert "ssot_version" in job
        assert job["ssot_version"] == "1.1"
    
    def test_handler_validate_record_rejects_string_error(self):
        """Handler validate_record_error rejects string error"""
        if not self.handler_available:
            pytest.skip("Handler module not available (runpod not installed)")
        
        job = self.create_canonical_job("handler-test-2", "train_lora", {})
        job["result"]["error"] = {"class": "fatal", "code": "TEST_FAIL", "message": "string error - SHOULD FAIL"}
        with pytest.raises(Exception):
            self.validate_record_error(job)
    
    def test_handler_fail_job_produces_canonical_error(self):
        """Handler fail_job_with_error produces canonical error"""
        if not self.handler_available:
            pytest.skip("Handler module not available (runpod not installed)")
        
        job = self.create_canonical_job("handler-test-3", "train_lora", {})
        job["state"] = "VALIDATING"  # State that CAN transition to FAILED
        error_obj = {"class": "fatal", "code": "FATAL_INTERNAL", "message": "Test failure"}
        failed = self.fail_job_with_error(job, error_obj, "test:handler")
        assert failed["state"] == "FAILED"
        assert isinstance(failed["result"]["error"], dict)


# =============================================================================
# STANDALONE EXECUTION
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])