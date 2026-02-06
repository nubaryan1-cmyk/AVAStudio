"""
AVA CANON STATE INVARIANTS TEST SUITE (IRONCLAD)

Tests all state machine invariants:
- 10 canonical states
- PAUSED/RETRYING permanently forbidden
- All transitions validated
- Terminal states have no outgoing transitions
- All forbidden states rejected

Canon Authority: _CANON/STATE_MODEL/STATE_MODEL.txt v2.0
"""

import sys
import os
import pytest

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ssot_state_validator import (
    CANON_STATES,
    CANON_TRANSITIONS,
    FORBIDDEN_STATES,
    TERMINAL_STATES,
    validate_state,
    validate_transition,
    CanonTransitionViolation
)


# =============================================================================
# STATE COUNT INVARIANTS
# =============================================================================

class TestStateCountInvariants:
    """State count invariants."""
    
    def test_exactly_10_canonical_states(self):
        """Canon has exactly 10 states."""
        assert len(CANON_STATES) == 10
    
    def test_canonical_state_names(self):
        """All 10 canonical states are present."""
        expected = {
            "CREATED", "VALIDATING", "READY", "IN_QUEUE", "SCHEDULED",
            "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "TIMEOUT"
        }
        assert CANON_STATES == expected
    
    def test_exactly_4_terminal_states(self):
        """Exactly 4 terminal states."""
        assert len(TERMINAL_STATES) == 4
        assert TERMINAL_STATES == {"COMPLETED", "FAILED", "CANCELLED", "TIMEOUT"}


# =============================================================================
# FORBIDDEN STATE INVARIANTS
# =============================================================================

class TestForbiddenStateInvariants:
    """Forbidden state invariants."""
    
    def test_paused_in_forbidden_set(self):
        """PAUSED is in forbidden set."""
        assert "PAUSED" in FORBIDDEN_STATES
    
    def test_retrying_in_forbidden_set(self):
        """RETRYING is in forbidden set."""
        assert "RETRYING" in FORBIDDEN_STATES
    
    def test_forbidden_states_not_in_canon(self):
        """Forbidden states are NOT in canonical states."""
        assert FORBIDDEN_STATES.isdisjoint(CANON_STATES)
    
    def test_paused_not_in_canon(self):
        """PAUSED is NOT in canonical states."""
        assert "PAUSED" not in CANON_STATES
    
    def test_retrying_not_in_canon(self):
        """RETRYING is NOT in canonical states."""
        assert "RETRYING" not in CANON_STATES
    
    def test_paused_rejected_by_validator(self):
        """PAUSED is rejected by validate_state."""
        with pytest.raises(CanonTransitionViolation):
            validate_state("PAUSED", "test:paused")
    
    def test_retrying_rejected_by_validator(self):
        """RETRYING is rejected by validate_state."""
        with pytest.raises(CanonTransitionViolation):
            validate_state("RETRYING", "test:retrying")
    
    def test_all_forbidden_states_rejected(self):
        """All forbidden states rejected by validator."""
        for state in FORBIDDEN_STATES:
            with pytest.raises(CanonTransitionViolation):
                validate_state(state, f"test:{state}")


# =============================================================================
# TRANSITION INVARIANTS
# =============================================================================

class TestTransitionInvariants:
    """Transition invariants."""
    
    def test_full_lifecycle_valid(self):
        """Full lifecycle CREATED в†’ COMPLETED is valid."""
        path = [
            ("CREATED", "VALIDATING"),
            ("VALIDATING", "READY"),
            ("READY", "IN_QUEUE"),
            ("IN_QUEUE", "SCHEDULED"),
            ("SCHEDULED", "RUNNING"),
            ("RUNNING", "COMPLETED")
        ]
        for from_state, to_state in path:
            validate_transition(from_state, to_state, "test:lifecycle")
    
    def test_failure_path_valid(self):
        """Failure path VALIDATING в†’ FAILED is valid."""
        validate_transition("VALIDATING", "FAILED", "test:fail_path")
        validate_transition("RUNNING", "FAILED", "test:fail_path")
    
    def test_cancel_from_non_terminal_states(self):
        """Cancel from non-terminal states is valid."""
        cancellable = ["CREATED", "VALIDATING", "READY", "IN_QUEUE", "SCHEDULED", "RUNNING"]
        for state in cancellable:
            validate_transition(state, "CANCELLED", f"test:cancel_{state}")
    
    def test_terminal_states_no_outgoing_except_failed(self):
        """Terminal states have no outgoing transitions (except FAILEDв†’CANCELLED)."""
        assert len(CANON_TRANSITIONS.get("COMPLETED", set())) == 0
        assert len(CANON_TRANSITIONS.get("CANCELLED", set())) == 0
        assert len(CANON_TRANSITIONS.get("TIMEOUT", set())) == 0
        # FAILED can go to CANCELLED
        assert CANON_TRANSITIONS.get("FAILED", set()) == {"CANCELLED"}
    
    def test_no_transition_to_paused(self):
        """No state can transition to PAUSED."""
        for state in CANON_STATES:
            with pytest.raises(CanonTransitionViolation):
                validate_transition(state, "PAUSED", f"test:{state}_to_paused")
    
    def test_no_transition_to_retrying(self):
        """No state can transition to RETRYING."""
        for state in CANON_STATES:
            with pytest.raises(CanonTransitionViolation):
                validate_transition(state, "RETRYING", f"test:{state}_to_retrying")
    
    def test_no_transition_from_paused(self):
        """PAUSED cannot transition to any state (forbidden source)."""
        for target in CANON_STATES:
            with pytest.raises(CanonTransitionViolation):
                validate_transition("PAUSED", target, "test:paused_to_any")
    
    def test_no_transition_from_retrying(self):
        """RETRYING cannot transition to any state (forbidden source)."""
        for target in CANON_STATES:
            with pytest.raises(CanonTransitionViolation):
                validate_transition("RETRYING", target, "test:retrying_to_any")


# =============================================================================
# ILLEGAL TRANSITION TESTS
# =============================================================================

class TestIllegalTransitions:
    """Illegal transition tests."""
    
    def test_created_cannot_skip_to_running(self):
        """CREATED в†’ RUNNING is illegal."""
        with pytest.raises(CanonTransitionViolation):
            validate_transition("CREATED", "RUNNING", "test:skip")
    
    def test_created_cannot_skip_to_completed(self):
        """CREATED в†’ COMPLETED is illegal."""
        with pytest.raises(CanonTransitionViolation):
            validate_transition("CREATED", "COMPLETED", "test:skip")
    
    def test_in_queue_cannot_skip_to_running(self):
        """IN_QUEUE в†’ RUNNING is illegal."""
        with pytest.raises(CanonTransitionViolation):
            validate_transition("IN_QUEUE", "RUNNING", "test:skip")
    
    def test_completed_cannot_restart(self):
        """COMPLETED в†’ RUNNING is illegal."""
        with pytest.raises(CanonTransitionViolation):
            validate_transition("COMPLETED", "RUNNING", "test:restart")
    
    def test_completed_cannot_go_to_created(self):
        """COMPLETED в†’ CREATED is illegal."""
        with pytest.raises(CanonTransitionViolation):
            validate_transition("COMPLETED", "CREATED", "test:reset")
    
    def test_backwards_transition_running_to_scheduled(self):
        """RUNNING в†’ SCHEDULED (backwards) is illegal."""
        with pytest.raises(CanonTransitionViolation):
            validate_transition("RUNNING", "SCHEDULED", "test:backwards")
    
    def test_backwards_transition_scheduled_to_in_queue(self):
        """SCHEDULED в†’ IN_QUEUE (backwards) is illegal."""
        with pytest.raises(CanonTransitionViolation):
            validate_transition("SCHEDULED", "IN_QUEUE", "test:backwards")


# =============================================================================
# UNKNOWN STATE TESTS
# =============================================================================

class TestUnknownStates:
    """Unknown state tests."""
    
    def test_unknown_state_rejected(self):
        """Unknown state rejected."""
        with pytest.raises(CanonTransitionViolation):
            validate_state("NONEXISTENT", "test:unknown")
    
    def test_lowercase_state_rejected(self):
        """Lowercase state rejected (case-sensitive)."""
        with pytest.raises(CanonTransitionViolation):
            validate_state("running", "test:lowercase")
    
    def test_mixed_case_state_rejected(self):
        """Mixed case state rejected."""
        with pytest.raises(CanonTransitionViolation):
            validate_state("Running", "test:mixedcase")
    
    def test_empty_state_rejected(self):
        """Empty state rejected."""
        with pytest.raises(CanonTransitionViolation):
            validate_state("", "test:empty")
    
    def test_whitespace_state_rejected(self):
        """Whitespace state rejected."""
        with pytest.raises(CanonTransitionViolation):
            validate_state("  ", "test:whitespace")


# =============================================================================
# STRESS TEST - ALL TRANSITIONS
# =============================================================================

class TestTransitionStress:
    """Stress test all valid and invalid transitions."""
    
    def test_all_valid_transitions_accepted(self):
        """All valid transitions are accepted."""
        for from_state, allowed in CANON_TRANSITIONS.items():
            for to_state in allowed:
                validate_transition(from_state, to_state, f"stress:{from_state}_to_{to_state}")
    
    def test_all_invalid_transitions_rejected(self):
        """All invalid transitions are rejected."""
        for from_state in CANON_STATES:
            allowed = CANON_TRANSITIONS.get(from_state, set())
            for to_state in CANON_STATES:
                if to_state not in allowed:
                    with pytest.raises(CanonTransitionViolation):
                        validate_transition(from_state, to_state, f"stress:{from_state}_to_{to_state}")
    
    def test_100_random_valid_transitions(self):
        """100 random valid transitions."""
        import random
        valid_pairs = []
        for from_state, allowed in CANON_TRANSITIONS.items():
            for to_state in allowed:
                valid_pairs.append((from_state, to_state))
        
        if valid_pairs:
            for i in range(100):
                from_state, to_state = random.choice(valid_pairs)
                validate_transition(from_state, to_state, f"random:{i}")
    
    def test_100_forbidden_state_rejections(self):
        """100 forbidden state rejection attempts."""
        import random
        forbidden_list = list(FORBIDDEN_STATES)
        for i in range(100):
            state = random.choice(forbidden_list)
            with pytest.raises(CanonTransitionViolation):
                validate_state(state, f"forbidden:{i}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])