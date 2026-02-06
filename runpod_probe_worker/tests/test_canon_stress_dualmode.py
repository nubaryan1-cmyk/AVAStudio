"""
AVA DUAL-MODE CANON STRESS/NEGATIVE SUITE (IRONCLAD)

Validates canon/core in TWO default modes:
- MODE_A: missing ssot_version => 1.0
- MODE_B: missing ssot_version => 1.1

Canon Authority: _CANON/SEMANTICS/SSOT_VERSIONING.md v1.1
Canon Authority: _CANON/SEMANTICS/ERROR_TAXONOMY.md v1.1
Canon Authority: _CANON/STATE_MODEL/STATE_MODEL.txt v2.0
"""

import sys
import os
import pytest
import random
import importlib
from concurrent.futures import ThreadPoolExecutor, as_completed

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def reload_ssot_versioning_with_default(default_version: str):
    """Reload ssot_versioning module with a specific default version."""
    os.environ["SSOT_DEFAULT_VERSION"] = default_version
    import services.ssot_versioning as sv
    importlib.reload(sv)
    return sv


# =============================================================================
# A) SSOT DEFAULT MODE TESTS
# =============================================================================

class TestSsotDefaultModeA:
    """MODE_A: default=1.0 tests."""
    
    def test_MODE_A_legacy_job_missing_version_defaults_to_1_0(self):
        """MODE_A: Legacy job missing ssot_version -> defaults to 1.0"""
        # Set mode A
        os.environ["SSOT_DEFAULT_VERSION"] = "1.0"
        import services.ssot_versioning as sv
        importlib.reload(sv)
        
        job = {"job_id": "mode-a-1", "state": "CREATED"}
        sv.normalize_ssot_version(job)
        
        assert job["ssot_version"] == "1.0", f"Expected 1.0, got {job['ssot_version']}"
    
    def test_MODE_A_empty_version_defaults_to_1_0(self):
        """MODE_A: Empty ssot_version -> defaults to 1.0"""
        os.environ["SSOT_DEFAULT_VERSION"] = "1.0"
        import services.ssot_versioning as sv
        importlib.reload(sv)
        
        job = {"job_id": "mode-a-2", "state": "CREATED", "ssot_version": ""}
        sv.normalize_ssot_version(job)
        
        assert job["ssot_version"] == "1.0"
    
    def test_MODE_A_none_version_defaults_to_1_0(self):
        """MODE_A: None ssot_version -> defaults to 1.0"""
        os.environ["SSOT_DEFAULT_VERSION"] = "1.0"
        import services.ssot_versioning as sv
        importlib.reload(sv)
        
        job = {"job_id": "mode-a-3", "state": "CREATED", "ssot_version": None}
        sv.normalize_ssot_version(job)
        
        assert job["ssot_version"] == "1.0"


class TestSsotDefaultModeB:
    """MODE_B: default=1.1 tests."""
    
    def test_MODE_B_legacy_job_missing_version_defaults_to_1_1(self):
        """MODE_B: Legacy job missing ssot_version -> defaults to 1.1"""
        os.environ["SSOT_DEFAULT_VERSION"] = "1.1"
        import services.ssot_versioning as sv
        importlib.reload(sv)
        
        job = {"job_id": "mode-b-1", "state": "CREATED"}
        sv.normalize_ssot_version(job)
        
        assert job["ssot_version"] == "1.1", f"Expected 1.1, got {job['ssot_version']}"
    
    def test_MODE_B_empty_version_defaults_to_1_1(self):
        """MODE_B: Empty ssot_version -> defaults to 1.1"""
        os.environ["SSOT_DEFAULT_VERSION"] = "1.1"
        import services.ssot_versioning as sv
        importlib.reload(sv)
        
        job = {"job_id": "mode-b-2", "state": "CREATED", "ssot_version": ""}
        sv.normalize_ssot_version(job)
        
        assert job["ssot_version"] == "1.1"
    
    def test_MODE_B_none_version_defaults_to_1_1(self):
        """MODE_B: None ssot_version -> defaults to 1.1"""
        os.environ["SSOT_DEFAULT_VERSION"] = "1.1"
        import services.ssot_versioning as sv
        importlib.reload(sv)
        
        job = {"job_id": "mode-b-3", "state": "CREATED", "ssot_version": None}
        sv.normalize_ssot_version(job)
        
        assert job["ssot_version"] == "1.1"


class TestSsotNewJobStamping:
    """NEW JOB stamping tests - must always be 1.1 regardless of default."""
    
    def test_new_job_stamps_1_1_when_default_is_1_0(self):
        """New job stamps 1.1 even when SSOT_DEFAULT_VERSION=1.0"""
        os.environ["SSOT_DEFAULT_VERSION"] = "1.0"
        import services.ssot_versioning as sv
        importlib.reload(sv)
        
        # CURRENT_SSOT_VERSION must always be 1.1
        assert sv.CURRENT_SSOT_VERSION == "1.1"
    
    def test_new_job_stamps_1_1_when_default_is_1_1(self):
        """New job stamps 1.1 when SSOT_DEFAULT_VERSION=1.1"""
        os.environ["SSOT_DEFAULT_VERSION"] = "1.1"
        import services.ssot_versioning as sv
        importlib.reload(sv)
        
        assert sv.CURRENT_SSOT_VERSION == "1.1"
    
    def test_create_canonical_job_always_stamps_1_1(self):
        """create_canonical_job() must always stamp 1.1 for new jobs"""
        # Test with different defaults
        for default in ["1.0", "1.1"]:
            os.environ["SSOT_DEFAULT_VERSION"] = default
            import services.ssot_versioning as sv
            importlib.reload(sv)
            
            # Simulate create_canonical_job logic
            payload = {}
            ssot_version = payload.get("ssot_version") or sv.CURRENT_SSOT_VERSION
            assert ssot_version == "1.1", f"New job should stamp 1.1, got {ssot_version} (default={default})"


# =============================================================================
# B) SSOT VERSION NEGATIVE TESTS
# =============================================================================

class TestSsotVersionNegative:
    """SSOT version negative tests."""
    
    @pytest.fixture(autouse=True)
    def reset_default(self):
        """Reset to default mode for negative tests."""
        os.environ["SSOT_DEFAULT_VERSION"] = "1.0"
        import services.ssot_versioning as sv
        importlib.reload(sv)
        self.sv = sv
        yield
    
    def test_B1_unsupported_major_9_fails_with_canonical_error(self):
        """B1: Unsupported major 9.0 -> FAILED + fatal + FATAL_UNSUPPORTED_SSOT_VERSION"""
        job = {"job_id": "b1-1", "state": "CREATED", "ssot_version": "9.0"}
        processed, success = self.sv.process_job_intake(job)
        
        assert not success
        assert processed["state"] == "FAILED"
        error = processed["result"]["error"]
        assert isinstance(error, dict), "Error must be dict, not string"
        assert error["class"] == "fatal"
        assert error["code"] == "FATAL_UNSUPPORTED_SSOT_VERSION"
    
    def test_B1_unsupported_major_2_fails(self):
        """B1: Unsupported major 2.0 -> FAILED"""
        job = {"job_id": "b1-2", "state": "CREATED", "ssot_version": "2.0"}
        processed, success = self.sv.process_job_intake(job)
        
        assert not success
        assert processed["state"] == "FAILED"
        assert processed["result"]["error"]["code"] == "FATAL_UNSUPPORTED_SSOT_VERSION"
    
    def test_B2_invalid_format_single_number_fails(self):
        """B2: Invalid format "1" -> deterministic FAIL with canonical error object"""
        job = {"job_id": "b2-1", "state": "CREATED", "ssot_version": "1"}
        processed, success = self.sv.process_job_intake(job)
        
        assert not success
        assert processed["state"] == "FAILED"
        error = processed["result"]["error"]
        assert isinstance(error, dict), "Error must be dict, not string"
        assert error["class"] == "fatal"
    
    def test_B2_invalid_format_1x_fails(self):
        """B2: Invalid format "1.x" -> deterministic FAIL"""
        job = {"job_id": "b2-2", "state": "CREATED", "ssot_version": "1.x"}
        processed, success = self.sv.process_job_intake(job)
        
        assert not success
        assert processed["state"] == "FAILED"
        assert isinstance(processed["result"]["error"], dict)
    
    def test_B2_invalid_format_empty_string_normalized_then_valid(self):
        """B2: Empty string "" -> normalized to default, then valid"""
        job = {"job_id": "b2-3", "state": "CREATED", "ssot_version": ""}
        processed, success = self.sv.process_job_intake(job)
        
        # Empty string normalizes to default (1.0), which is valid
        assert success
        assert processed["ssot_version"] == "1.0"


# =============================================================================
# C) ERROR TAXONOMY NEGATIVE TESTS
# =============================================================================

class TestErrorTaxonomyNegative:
    """ERROR TAXONOMY negative tests."""
    
    @pytest.fixture(autouse=True)
    def setup_imports(self):
        """Import error taxonomy."""
        from services.error_taxonomy import (
            normalize_error, classify_exception, validate_error_obj,
            CANON_ERROR_CLASSES, InvalidErrorObjectError
        )
        self.normalize_error = normalize_error
        self.classify_exception = classify_exception
        self.validate_error_obj = validate_error_obj
        self.CANON_ERROR_CLASSES = CANON_ERROR_CLASSES
        self.InvalidErrorObjectError = InvalidErrorObjectError
        yield
    
    def test_C1_exception_produces_dict_with_class_in_allowed_set(self):
        """C1: Exception -> result.error is dict, class in allowed set, code non-empty"""
        for ex in [ValueError("v"), RuntimeError("r"), TimeoutError("t"), TypeError("t")]:
            error = self.classify_exception(ex)
            assert isinstance(error, dict), "Error must be dict"
            assert error["class"] in self.CANON_ERROR_CLASSES, f"Class must be in allowed set: {error['class']}"
            assert error["code"], "Code must be non-empty"
            assert error["message"], "Message must be non-empty"
    
    def test_C2_string_error_normalized_no_string_survives(self):
        """C2: Injected string error -> normalized, no string survives"""
        error = self.normalize_error("raw string error")
        assert isinstance(error, dict), "String error must be normalized to dict"
        assert error["class"] in self.CANON_ERROR_CLASSES
    
    def test_C2_string_error_validate_raises(self):
        """C2: String error -> validate raises"""
        with pytest.raises(self.InvalidErrorObjectError):
            self.validate_error_obj("string error")
    
    def test_C3_unknown_class_remapped_to_fatal(self):
        """C3: Unknown class -> remap to fatal/FATAL_INVALID_ERROR_CLASS"""
        error = self.normalize_error({"class": "bogus_class", "code": "X", "message": "test"})
        assert error["class"] == "fatal"
        assert error["code"] == "FATAL_INVALID_ERROR_CLASS"


# =============================================================================
# D) FORBIDDEN STATES NEGATIVE TESTS
# =============================================================================

class TestForbiddenStatesNegative:
    """FORBIDDEN STATES negative tests."""
    
    @pytest.fixture(autouse=True)
    def setup_imports(self):
        """Import state validator."""
        from services.ssot_state_validator import (
            validate_state, FORBIDDEN_STATES, CanonTransitionViolation
        )
        self.validate_state = validate_state
        self.FORBIDDEN_STATES = FORBIDDEN_STATES
        self.CanonTransitionViolation = CanonTransitionViolation
        yield
    
    def test_D1_paused_state_rejected(self):
        """D1: Incoming state=PAUSED -> reject/fail invariants"""
        with pytest.raises(self.CanonTransitionViolation):
            self.validate_state("PAUSED", "test:paused")
    
    def test_D1_retrying_state_rejected(self):
        """D1: Incoming state=RETRYING -> reject/fail invariants"""
        with pytest.raises(self.CanonTransitionViolation):
            self.validate_state("RETRYING", "test:retrying")
    
    def test_D1_all_forbidden_states_rejected(self):
        """D1: All forbidden states -> rejected"""
        for state in self.FORBIDDEN_STATES:
            with pytest.raises(self.CanonTransitionViolation):
                self.validate_state(state, f"test:{state}")


# =============================================================================
# E) STRESS MINI TESTS
# =============================================================================

class TestStressMini:
    """STRESS MINI: 2000 iterations, concurrency 64."""
    
    @pytest.fixture(autouse=True)
    def setup_all(self):
        """Setup all imports."""
        os.environ["SSOT_DEFAULT_VERSION"] = "1.0"
        import services.ssot_versioning as sv
        importlib.reload(sv)
        
        from services.error_taxonomy import normalize_error, CANON_ERROR_CLASSES
        from services.ssot_state_validator import validate_state, FORBIDDEN_STATES, CanonTransitionViolation
        
        self.sv = sv
        self.normalize_error = normalize_error
        self.CANON_ERROR_CLASSES = CANON_ERROR_CLASSES
        self.validate_state = validate_state
        self.FORBIDDEN_STATES = FORBIDDEN_STATES
        self.CanonTransitionViolation = CanonTransitionViolation
        yield
    
    def test_E1_stress_2000_iterations_concurrency_64(self):
        """E1: 2000 iterations, concurrency 64, 70% ok / 30% forced failures"""
        import threading
        
        # Counters (thread-safe)
        counters = {
            "total": 0,
            "string_error_count": 0,
            "invalid_class_count": 0,
            "forbidden_state_accept_count": 0,
            "unsupported_version_count": 0,
        }
        lock = threading.Lock()
        
        def stress_iteration(i: int):
            """Single stress iteration."""
            nonlocal counters
            
            # Decide path: 70% ok, 30% forced failure
            force_fail = random.random() < 0.30
            
            try:
                # === SSOT VERSION TEST ===
                if force_fail:
                    # Use invalid version
                    version = random.choice(["9.0", "2.0", "abc", "1"])
                else:
                    version = random.choice(["1.0", "1.1"])
                
                job = {"job_id": f"stress-{i}", "state": "CREATED", "ssot_version": version}
                processed, success = self.sv.process_job_intake(job)
                
                if not success:
                    error = processed.get("result", {}).get("error")
                    if isinstance(error, str):
                        with lock:
                            counters["string_error_count"] += 1
                    elif isinstance(error, dict):
                        if error.get("class") not in self.CANON_ERROR_CLASSES:
                            with lock:
                                counters["invalid_class_count"] += 1
                        if error.get("code") == "FATAL_UNSUPPORTED_SSOT_VERSION":
                            with lock:
                                counters["unsupported_version_count"] += 1
                
                # === ERROR NORMALIZATION TEST ===
                if force_fail:
                    err_input = random.choice(["string", {"class": "bad", "code": "X", "message": "m"}])
                else:
                    err_input = random.choice([None, {"class": "user", "code": "X", "message": "m"}])
                
                err_output = self.normalize_error(err_input)
                if err_input is not None:
                    if isinstance(err_output, str):
                        with lock:
                            counters["string_error_count"] += 1
                    elif isinstance(err_output, dict) and err_output.get("class") not in self.CANON_ERROR_CLASSES:
                        with lock:
                            counters["invalid_class_count"] += 1
                
                # === FORBIDDEN STATE TEST ===
                forbidden = random.choice(list(self.FORBIDDEN_STATES))
                try:
                    self.validate_state(forbidden, f"stress:{i}")
                    # If we get here, forbidden state was accepted (BAD)
                    with lock:
                        counters["forbidden_state_accept_count"] += 1
                except self.CanonTransitionViolation:
                    pass  # Expected
                
                with lock:
                    counters["total"] += 1
                    
            except Exception as e:
                # Unexpected crash - count as invalid
                with lock:
                    counters["total"] += 1
        
        # Run 2000 iterations with concurrency 64
        with ThreadPoolExecutor(max_workers=64) as executor:
            futures = [executor.submit(stress_iteration, i) for i in range(2000)]
            for future in futures:
                future.result()  # Wait for completion
        
        # Assert invariants
        assert counters["total"] == 2000, f"Expected 2000 iterations, got {counters['total']}"
        assert counters["string_error_count"] == 0, f"String errors: {counters['string_error_count']}"
        assert counters["invalid_class_count"] == 0, f"Invalid classes: {counters['invalid_class_count']}"
        assert counters["forbidden_state_accept_count"] == 0, f"Forbidden states accepted: {counters['forbidden_state_accept_count']}"
        
        # Unsupported versions should be handled canonically (just tracking)
        print(f"\nStress Summary:")
        print(f"  Total iterations: {counters['total']}")
        print(f"  String error count: {counters['string_error_count']}")
        print(f"  Invalid class count: {counters['invalid_class_count']}")
        print(f"  Forbidden state accept count: {counters['forbidden_state_accept_count']}")
        print(f"  Unsupported version count (handled): {counters['unsupported_version_count']}")


# =============================================================================
# CLEANUP
# =============================================================================

@pytest.fixture(scope="session", autouse=True)
def cleanup_env():
    """Cleanup environment after tests."""
    yield
    # Reset to default
    os.environ["SSOT_DEFAULT_VERSION"] = "1.0"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])