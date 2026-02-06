"""
AVA CANON STRESS/NEGATIVE TEST SUITE (IRONCLAD)

Proves:
- SSOT_VERSIONING enforced
- ERROR_TAXONOMY enforced
- State machine invariants enforced (forbidden states never accepted)
- No schema drift escapes
- Production-grade error envelopes

Canon Authority: _CANON/SEMANTICS/ERROR_TAXONOMY.md v1.1
Canon Authority: _CANON/SEMANTICS/SSOT_VERSIONING.md v1.1
Canon Authority: _CANON/STATE_MODEL/STATE_MODEL.txt v2.0
"""

import sys
import os
import pytest
import random
import string

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.error_taxonomy import (
    normalize_error,
    classify_exception,
    validate_error_obj,
    create_error,
    CANON_ERROR_CLASSES,
    InvalidErrorObjectError
)
from services.ssot_versioning import (
    normalize_ssot_version,
    validate_ssot_version,
    process_job_intake,
    UnsupportedSsotVersionError,
    DEFAULT_SSOT_VERSION,
    CURRENT_SSOT_VERSION,
    SUPPORTED_MAJOR_VERSIONS
)
from services.ssot_state_validator import (
    CANON_STATES,
    CANON_TRANSITIONS,
    FORBIDDEN_STATES,
    TERMINAL_STATES,
    validate_state,
    validate_transition,
    CanonTransitionViolation
)
from services.lifecycle import now


# =============================================================================
# A) SSOT VERSIONING NEGATIVE TESTS
# =============================================================================

class TestSsotVersioningNegative:
    """Negative tests for SSOT_VERSIONING enforcement."""
    
    def test_missing_ssot_version_normalized_to_legacy_default(self):
        """Missing ssot_version -> normalized to legacy default (1.0)"""
        job = {"job_id": "neg-1", "state": "CREATED"}
        normalize_ssot_version(job)
        assert job["ssot_version"] == DEFAULT_SSOT_VERSION
        assert job["ssot_version"] == "1.0"
    
    def test_empty_ssot_version_normalized_to_legacy_default(self):
        """Empty ssot_version -> normalized to legacy default"""
        job = {"job_id": "neg-2", "state": "CREATED", "ssot_version": ""}
        normalize_ssot_version(job)
        assert job["ssot_version"] == DEFAULT_SSOT_VERSION
    
    def test_none_ssot_version_normalized_to_legacy_default(self):
        """None ssot_version -> normalized to legacy default"""
        job = {"job_id": "neg-3", "state": "CREATED", "ssot_version": None}
        normalize_ssot_version(job)
        assert job["ssot_version"] == DEFAULT_SSOT_VERSION
    
    def test_unsupported_major_v2_fails_with_canonical_error(self):
        """Unsupported major v2.0 -> FAILED + fatal/FATAL_UNSUPPORTED_SSOT_VERSION"""
        job = {"job_id": "neg-4", "state": "CREATED", "ssot_version": "2.0"}
        processed, success = process_job_intake(job)
        assert not success
        assert processed["state"] == "FAILED"
        error = processed["result"]["error"]
        assert error["class"] == "fatal"
        assert error["code"] == "FATAL_UNSUPPORTED_SSOT_VERSION"
    
    def test_unsupported_major_v9_fails_with_canonical_error(self):
        """Unsupported major v9.0 -> FAILED + fatal/FATAL_UNSUPPORTED_SSOT_VERSION"""
        job = {"job_id": "neg-5", "state": "CREATED", "ssot_version": "9.0"}
        processed, success = process_job_intake(job)
        assert not success
        assert processed["state"] == "FAILED"
        error = processed["result"]["error"]
        assert error["class"] == "fatal"
        assert error["code"] == "FATAL_UNSUPPORTED_SSOT_VERSION"
    
    def test_unsupported_major_v99_fails(self):
        """Unsupported major v99.99 -> FAILED"""
        job = {"job_id": "neg-6", "state": "CREATED", "ssot_version": "99.99"}
        processed, success = process_job_intake(job)
        assert not success
        assert processed["state"] == "FAILED"
    
    def test_invalid_format_single_number_fails(self):
        """Invalid format (single number) -> deterministic FAIL"""
        job = {"job_id": "neg-7", "state": "CREATED", "ssot_version": "1"}
        processed, success = process_job_intake(job)
        assert not success
        assert processed["state"] == "FAILED"
        error = processed["result"]["error"]
        assert isinstance(error, dict)
        assert error["class"] == "fatal"
    
    def test_invalid_format_triple_number_fails(self):
        """Invalid format (triple number) -> deterministic FAIL"""
        job = {"job_id": "neg-8", "state": "CREATED", "ssot_version": "1.0.0"}
        processed, success = process_job_intake(job)
        assert not success
        assert processed["state"] == "FAILED"
    
    def test_invalid_format_letters_fails(self):
        """Invalid format (letters) -> deterministic FAIL"""
        job = {"job_id": "neg-9", "state": "CREATED", "ssot_version": "abc"}
        processed, success = process_job_intake(job)
        assert not success
        assert processed["state"] == "FAILED"
    
    def test_invalid_format_negative_version_fails(self):
        """Invalid format (negative) -> deterministic FAIL"""
        job = {"job_id": "neg-10", "state": "CREATED", "ssot_version": "-1.0"}
        processed, success = process_job_intake(job)
        assert not success
        assert processed["state"] == "FAILED"


# =============================================================================
# B) ERROR TAXONOMY NEGATIVE TESTS
# =============================================================================

class TestErrorTaxonomyNegative:
    """Negative tests for ERROR_TAXONOMY enforcement."""
    
    def test_runtime_exception_produces_error_dict_not_string(self):
        """Runtime exception -> error object dict (not string)"""
        ex = RuntimeError("Something broke")
        error = classify_exception(ex)
        assert isinstance(error, dict)
        assert not isinstance(error, str)
        assert "class" in error
        assert "code" in error
        assert "message" in error
    
    def test_runtime_exception_class_in_allowed_set(self):
        """Runtime exception -> class in allowed set"""
        for ex in [ValueError("v"), TypeError("t"), RuntimeError("r"), 
                   TimeoutError("to"), MemoryError(), FileNotFoundError("f")]:
            error = classify_exception(ex)
            assert error["class"] in CANON_ERROR_CLASSES
    
    def test_string_error_normalized_not_survives(self):
        """Injected string error -> normalized (no string survives)"""
        error = normalize_error("raw string error")
        assert isinstance(error, dict)
        assert error["class"] == "fatal"
        assert error["code"] == "FATAL_UNCLASSIFIED"
    
    def test_string_error_validate_raises(self):
        """String error -> validate_error_obj raises"""
        with pytest.raises(InvalidErrorObjectError):
            validate_error_obj("string error")
    
    def test_unknown_error_class_normalized_to_fatal(self):
        """Unknown error.class -> fatal/FATAL_INVALID_ERROR_CLASS"""
        error = normalize_error({"class": "bogus", "code": "X", "message": "test"})
        assert error["class"] == "fatal"
        assert error["code"] == "FATAL_INVALID_ERROR_CLASS"
    
    def test_empty_class_normalized_to_fatal(self):
        """Empty error.class -> normalized to fatal"""
        error = normalize_error({"class": "", "code": "X", "message": "test"})
        assert error["class"] == "fatal"
    
    def test_none_class_normalized_to_fatal(self):
        """None error.class -> normalized to fatal"""
        error = normalize_error({"class": None, "code": "X", "message": "test"})
        assert error["class"] == "fatal"
    
    def test_integer_error_normalized(self):
        """Integer error -> normalized to dict"""
        error = normalize_error(12345)
        assert isinstance(error, dict)
        assert error["class"] == "fatal"
    
    def test_list_error_normalized(self):
        """List error -> normalized to dict"""
        error = normalize_error(["error", "list"])
        assert isinstance(error, dict)
        assert error["class"] == "fatal"
    
    def test_deeply_nested_exception_handled(self):
        """Deeply nested exception -> handled gracefully"""
        try:
            try:
                try:
                    raise ValueError("deep")
                except ValueError:
                    raise RuntimeError("middle")
            except RuntimeError:
                raise TypeError("outer")
        except TypeError as e:
            error = classify_exception(e)
            assert isinstance(error, dict)
            assert error["class"] in CANON_ERROR_CLASSES


# =============================================================================
# C) STATE MACHINE NEGATIVE TESTS
# =============================================================================

class TestStateMachineNegative:
    """Negative tests for state machine invariants."""
    
    def test_paused_state_rejected(self):
        """PAUSED state -> rejected/fails invariants"""
        with pytest.raises(CanonTransitionViolation):
            validate_state("PAUSED", "test:paused")
    
    def test_retrying_state_rejected(self):
        """RETRYING state -> rejected/fails invariants"""
        with pytest.raises(CanonTransitionViolation):
            validate_state("RETRYING", "test:retrying")
    
    def test_all_forbidden_states_rejected(self):
        """All forbidden states -> rejected"""
        for state in FORBIDDEN_STATES:
            with pytest.raises(CanonTransitionViolation):
                validate_state(state, f"test:{state}")
    
    def test_illegal_transition_created_to_running_rejected(self):
        """Illegal transition CREATED -> RUNNING -> rejected"""
        with pytest.raises(CanonTransitionViolation):
            validate_transition("CREATED", "RUNNING", "test:illegal1")
    
    def test_illegal_transition_created_to_completed_rejected(self):
        """Illegal transition CREATED -> COMPLETED -> rejected"""
        with pytest.raises(CanonTransitionViolation):
            validate_transition("CREATED", "COMPLETED", "test:illegal2")
    
    def test_illegal_transition_in_queue_to_running_rejected(self):
        """Illegal transition IN_QUEUE -> RUNNING -> rejected"""
        with pytest.raises(CanonTransitionViolation):
            validate_transition("IN_QUEUE", "RUNNING", "test:illegal3")
    
    def test_illegal_transition_completed_to_running_rejected(self):
        """Illegal transition COMPLETED -> RUNNING -> rejected"""
        with pytest.raises(CanonTransitionViolation):
            validate_transition("COMPLETED", "RUNNING", "test:illegal4")
    
    def test_illegal_transition_to_paused_rejected(self):
        """Illegal transition to PAUSED -> rejected"""
        for state in CANON_STATES:
            with pytest.raises(CanonTransitionViolation):
                validate_transition(state, "PAUSED", f"test:{state}_to_paused")
    
    def test_illegal_transition_to_retrying_rejected(self):
        """Illegal transition to RETRYING -> rejected"""
        for state in CANON_STATES:
            with pytest.raises(CanonTransitionViolation):
                validate_transition(state, "RETRYING", f"test:{state}_to_retrying")
    
    def test_unknown_state_rejected(self):
        """Unknown state -> rejected"""
        with pytest.raises(CanonTransitionViolation):
            validate_state("NONEXISTENT_STATE", "test:unknown")
    
    def test_lowercase_state_rejected(self):
        """Lowercase state -> rejected"""
        with pytest.raises(CanonTransitionViolation):
            validate_state("running", "test:lowercase")


# =============================================================================
# D) FUZZ TESTS
# =============================================================================

class TestFuzzInputs:
    """Fuzz tests - wrong types, missing fields, huge payloads."""
    
    def test_wrong_type_ssot_version_int(self):
        """Wrong type: ssot_version as int -> handled"""
        job = {"job_id": "fuzz-1", "state": "CREATED", "ssot_version": 123}
        # Should not crash
        try:
            processed, success = process_job_intake(job)
            # Either normalized or failed, but no crash
            assert processed is not None
        except Exception as e:
            # If it raises, it must be a controlled exception
            assert isinstance(e, (ValueError, TypeError, UnsupportedSsotVersionError))
    
    def test_wrong_type_ssot_version_list(self):
        """Wrong type: ssot_version as list -> handled"""
        job = {"job_id": "fuzz-2", "state": "CREATED", "ssot_version": [1, 0]}
        try:
            processed, success = process_job_intake(job)
            assert processed is not None
        except Exception as e:
            assert isinstance(e, (ValueError, TypeError, UnsupportedSsotVersionError, AttributeError))
    
    def test_missing_all_fields(self):
        """Missing all fields -> handled"""
        job = {}
        normalize_ssot_version(job)
        assert "ssot_version" in job
    
    def test_huge_payload_string(self):
        """Huge payload string (1MB) -> handled"""
        huge_string = "x" * (1024 * 1024)
        error = normalize_error(huge_string)
        assert isinstance(error, dict)
        # Message should be truncated
        assert len(error["message"]) <= 500
    
    def test_huge_payload_error_message(self):
        """Huge error message -> truncated"""
        huge_msg = "error" * 100000
        error = normalize_error({"class": "user", "code": "TEST", "message": huge_msg})
        assert len(error["message"]) <= 500
    
    def test_unknown_fields_flood(self):
        """Unknown fields flood -> ignored, core fields preserved"""
        job = {
            "job_id": "fuzz-flood",
            "state": "CREATED",
            "ssot_version": "1.0",
            "unknown1": "garbage",
            "unknown2": 12345,
            "unknown3": [1, 2, 3],
            "unknown4": {"nested": "data"},
            "unknown5": None,
        }
        processed, success = process_job_intake(job)
        assert success
        assert processed["ssot_version"] == "1.0"
    
    def test_special_characters_in_version(self):
        """Special characters in version -> handled"""
        for version in ["1.0\x00", "1.0\n", "1.0;DROP TABLE", "<script>", "1.0' OR '1'='1"]:
            job = {"job_id": "fuzz-special", "state": "CREATED", "ssot_version": version}
            processed, success = process_job_intake(job)
            # Should fail gracefully, not crash
            assert processed is not None
    
    def test_unicode_in_error_message(self):
        """Unicode in error message -> handled"""
        error = normalize_error("Error: ж—Ґжњ¬иЄћ Г©mojis рџ”Ґрџ’Ґ")
        assert isinstance(error, dict)
        assert error["class"] == "fatal"
    
    def test_null_bytes_in_payload(self):
        """Null bytes in payload -> handled"""
        error = normalize_error("Error\x00with\x00nulls")
        assert isinstance(error, dict)
    
    def test_empty_string_fields(self):
        """Empty string fields -> handled"""
        error = normalize_error({"class": "", "code": "", "message": ""})
        assert isinstance(error, dict)


# =============================================================================
# E) STRESS TEST (Lightweight version for pytest)
# =============================================================================

class TestStressLightweight:
    """Lightweight stress tests for pytest (full stress in stress_runner.py)."""
    
    def test_stress_100_valid_jobs(self):
        """100 valid jobs -> all processed without crash"""
        for i in range(100):
            job = {"job_id": f"stress-{i}", "state": "CREATED", "ssot_version": "1.1"}
            processed, success = process_job_intake(job)
            assert success
            assert processed["ssot_version"] == "1.1"
    
    def test_stress_100_error_normalizations(self):
        """100 error normalizations -> all return valid objects"""
        error_inputs = [
            "string error",
            {"class": "user", "code": "TEST", "message": "test"},
            {"class": "invalid", "code": "TEST", "message": "test"},
            None,
            RuntimeError("ex"),
        ]
        for i in range(100):
            err = error_inputs[i % len(error_inputs)]
            result = normalize_error(err)
            if err is not None:
                assert isinstance(result, dict)
                assert result["class"] in CANON_ERROR_CLASSES
    
    def test_stress_100_state_validations(self):
        """100 state validations -> all valid states accepted"""
        for i in range(100):
            state = list(CANON_STATES)[i % len(CANON_STATES)]
            validate_state(state, f"stress:{i}")  # Should not raise
    
    def test_stress_100_forbidden_state_rejections(self):
        """100 forbidden state rejections -> all rejected"""
        forbidden_list = list(FORBIDDEN_STATES)
        for i in range(100):
            state = forbidden_list[i % len(forbidden_list)]
            with pytest.raises(CanonTransitionViolation):
                validate_state(state, f"stress-forbidden:{i}")
    
    def test_stress_randomized_mixed_inputs(self):
        """200 randomized mixed inputs -> no crashes, all canonical"""
        versions = ["1.0", "1.1", "2.0", "9.0", "abc", "", None, "1"]
        errors_in = ["string", {"class": "user", "code": "X", "message": "m"}, 
                     {"class": "bad", "code": "X", "message": "m"}, None, 123]
        
        for i in range(200):
            # SSOT versioning
            v = versions[i % len(versions)]
            job = {"job_id": f"mix-{i}", "state": "CREATED"}
            if v is not None:
                job["ssot_version"] = v
            processed, success = process_job_intake(job)
            assert processed is not None
            if success:
                assert processed["ssot_version"] in ["1.0", "1.1"]
            else:
                assert processed["state"] == "FAILED"
                assert isinstance(processed["result"]["error"], dict)
            
            # Error normalization
            err_in = errors_in[i % len(errors_in)]
            err_out = normalize_error(err_in)
            if err_in is not None:
                assert isinstance(err_out, dict)
                assert err_out["class"] in CANON_ERROR_CLASSES


# =============================================================================
# INVARIANT ASSERTIONS
# =============================================================================

class TestInvariants:
    """Final invariant checks."""
    
    def test_canon_states_count_is_10(self):
        """Canon states count is exactly 10"""
        assert len(CANON_STATES) == 10
    
    def test_forbidden_states_not_in_canon(self):
        """Forbidden states are not in canon states"""
        assert FORBIDDEN_STATES.isdisjoint(CANON_STATES)
    
    def test_paused_retrying_in_forbidden(self):
        """PAUSED and RETRYING are in forbidden set"""
        assert "PAUSED" in FORBIDDEN_STATES
        assert "RETRYING" in FORBIDDEN_STATES
    
    def test_terminal_states_have_no_transitions(self):
        """Terminal states have no outgoing transitions (except FAILED->CANCELLED)"""
        for state in ["COMPLETED", "CANCELLED", "TIMEOUT"]:
            assert len(CANON_TRANSITIONS.get(state, set())) == 0
    
    def test_error_classes_are_five(self):
        """Error classes are exactly 5"""
        assert len(CANON_ERROR_CLASSES) == 5
        assert CANON_ERROR_CLASSES == {"infra", "user", "model", "quota", "fatal"}
    
    def test_supported_major_version_is_1(self):
        """Supported major version is exactly {1}"""
        assert SUPPORTED_MAJOR_VERSIONS == {1}


if __name__ == "__main__":
    pytest.main([__file__, "-v"])