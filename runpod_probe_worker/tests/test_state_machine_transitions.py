"""
AVA TESTS - STATE MACHINE TRANSITIONS (REFACTORED)
Tests state transitions enforcement using SSOT validators.
Moved from legacy test_state_transitions_gate.py.
"""
import pytest
import os
import sys

# Add parent to path to find services
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ssot_state_validator import (
    validate_transition,
    CanonTransitionViolation,
    CANON_STATES,
    CANON_TRANSITIONS,
    FORBIDDEN_STATES
)
from services.job_core import get_job_core

class TestStateTransitionGate:
    """Test state transition enforcement."""
    
    def test_canon_states_count(self):
        """CANON: Exactly 10 states."""
        assert len(CANON_STATES) == 10
    
    def test_forbidden_states_not_in_canon(self):
        """CANON: PAUSED and RETRYING are forbidden."""
        for forbidden in FORBIDDEN_STATES:
            assert forbidden not in CANON_STATES
    
    def test_valid_transitions(self):
        """Test all valid transitions pass."""
        valid_transitions = [
            ("CREATED", "VALIDATING"),
            ("VALIDATING", "READY"),
            ("READY", "IN_QUEUE"),
            ("IN_QUEUE", "SCHEDULED"),
            ("SCHEDULED", "RUNNING"),
            ("RUNNING", "COMPLETED"),
            ("RUNNING", "FAILED"),
            ("CREATED", "CANCELLED")
        ]
        for from_state, to_state in valid_transitions:
            validate_transition(from_state, to_state, "test")
            
    def test_invalid_transitions_rejected(self):
        """Test invalid transitions raise CanonTransitionViolation."""
        invalid_transitions = [
            ("CREATED", "RUNNING"),
            ("COMPLETED", "RUNNING"),
            ("IN_QUEUE", "FAILED")
        ]
        for from_state, to_state in invalid_transitions:
            with pytest.raises(CanonTransitionViolation) as exc_info:
                validate_transition(from_state, to_state, "test")
            assert exc_info.value.error_code == "CANON_TRANSITION_VIOLATION"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
