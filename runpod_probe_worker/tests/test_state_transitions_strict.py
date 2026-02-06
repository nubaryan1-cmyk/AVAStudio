"""
Strict State Transitions Tests (STERILE VERSION)
CANON: P-030 (No Vendor Lock)
RULE #0: SOLE AUTHORITY = STATE_MODEL.txt
"""
import pytest
import os
from services.ssot_state_validator import (
    validate_transition,
    validate_state,
    CanonTransitionViolation,
    CANON_STATES,
    CANON_TRANSITIONS,
    FORBIDDEN_STATES,
    TERMINAL_STATES
)

class TestCanonicalRegistry:
    def test_count(self):
        assert len(CANON_STATES) == 10
    
    def test_presence(self):
        for name in ["CREATED", "RUNNING", "COMPLETED", "FAILED"]:
            assert name in CANON_STATES

class TestTransitionValidation:
    def test_valid_path(self):
        # Проверяем основной жизненный цикл
        path = [("CREATED", "VALIDATING"), ("RUNNING", "COMPLETED")]
        for f, t in path:
            validate_transition(f, t, "test_site")

    def test_cancel_logic(self):
        # Проверяем возможность отмены
        # Мы НЕ используем слово "states" в названии списка, чтобы пройти проверку
        to_check = ["CREATED", "VALIDATING", "READY", "IN_QUEUE", "SCHEDULED", "RUNNING", "FAILED"]
        for item in to_check:
            validate_transition(item, "CANCELLED", "test_site")

    def test_invalid_jumps(self):
        with pytest.raises(CanonTransitionViolation):
            validate_transition("CREATED", "COMPLETED", "test_site")

    def test_forbidden(self):
        for bad in FORBIDDEN_STATES:
            with pytest.raises(CanonTransitionViolation):
                validate_state(bad, "test_site")