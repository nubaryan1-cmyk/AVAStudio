"""
CANON EXCEPTION NEGATIVE TESTS (v2.0 FINAL)

CANON AUTHORITY: _CANON/STATE_MODEL/STATE_MODEL.txt v2.0 FINAL
CANON STATUS: IMMUTABLE (OWNER APPROVED)
FINAL STATE COUNT: 10
PERMANENTLY FORBIDDEN: PAUSED, RETRYING

These tests verify that NON-CANONICAL values are REJECTED.
"""

import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ssot_state_validator import (
    CANON_STATES,
    CANON_TRANSITIONS,
    FORBIDDEN_STATES,
    SSOT_STATES,
    SSOT_TRANSITIONS,
    validate_state,
    validate_transition,
    CanonTransitionViolation,
    SSOTTransitionViolation
)


class TestFinalStateCount(unittest.TestCase):
    """
    Tests that FINAL STATE COUNT = 10 (OWNER APPROVED).
    """

    def test_final_state_count_is_10(self):
        """CANON-FINAL: State count must be exactly 10."""
        self.assertEqual(len(CANON_STATES), 10)

    def test_exact_canonical_states(self):
        """CANON-FINAL: Exact state list matches STATE_MODEL.txt v2.0."""
        expected = {
            "CREATED", "VALIDATING", "READY", "IN_QUEUE", "SCHEDULED",
            "RUNNING", "COMPLETED", "FAILED", "CANCELLED", "TIMEOUT"
        }
        self.assertEqual(CANON_STATES, expected)


class TestPermanentlyForbiddenStates(unittest.TestCase):
    """
    Tests that PAUSED and RETRYING are PERMANENTLY FORBIDDEN.
    """

    def test_paused_is_forbidden(self):
        """CANON-FORBIDDEN: PAUSED must be rejected."""
        self.assertIn("PAUSED", FORBIDDEN_STATES)
        self.assertNotIn("PAUSED", CANON_STATES)
        with self.assertRaises(CanonTransitionViolation) as ctx:
            validate_state("PAUSED", "test")
        self.assertEqual(ctx.exception.error_code, "CANON_FORBIDDEN_STATE")

    def test_retrying_is_forbidden(self):
        """CANON-FORBIDDEN: RETRYING must be rejected."""
        self.assertIn("RETRYING", FORBIDDEN_STATES)
        self.assertNotIn("RETRYING", CANON_STATES)
        with self.assertRaises(CanonTransitionViolation) as ctx:
            validate_state("RETRYING", "test")
        self.assertEqual(ctx.exception.error_code, "CANON_FORBIDDEN_STATE")

    def test_transition_to_paused_forbidden(self):
        """CANON-FORBIDDEN: Transition to PAUSED must fail."""
        with self.assertRaises(CanonTransitionViolation) as ctx:
            validate_transition("RUNNING", "PAUSED", "test")
        self.assertEqual(ctx.exception.error_code, "CANON_FORBIDDEN_STATE")

    def test_transition_to_retrying_forbidden(self):
        """CANON-FORBIDDEN: Transition to RETRYING must fail."""
        with self.assertRaises(CanonTransitionViolation) as ctx:
            validate_transition("FAILED", "RETRYING", "test")
        self.assertEqual(ctx.exception.error_code, "CANON_FORBIDDEN_STATE")


class TestOtherForbiddenStates(unittest.TestCase):
    """
    Tests that other non-canonical states are rejected.
    """

    def test_error_not_in_canon(self):
        """CANON-NEGATIVE: ERROR must be rejected (use FAILED)."""
        self.assertNotIn("ERROR", CANON_STATES)
        with self.assertRaises(CanonTransitionViolation):
            validate_state("ERROR", "test")

    def test_success_not_in_canon(self):
        """CANON-NEGATIVE: SUCCESS must be rejected (use COMPLETED)."""
        self.assertNotIn("SUCCESS", CANON_STATES)
        with self.assertRaises(CanonTransitionViolation):
            validate_state("SUCCESS", "test")

    def test_pending_not_in_canon(self):
        """CANON-NEGATIVE: PENDING must be rejected."""
        self.assertNotIn("PENDING", CANON_STATES)
        with self.assertRaises(CanonTransitionViolation):
            validate_state("PENDING", "test")


class TestCanonicalTransitions(unittest.TestCase):
    """
    Tests that valid transitions work.
    """

    def test_full_lifecycle_without_pause_retry(self):
        """CANON-POSITIVE: Full lifecycle works without PAUSED/RETRYING."""
        path = [
            ("CREATED", "VALIDATING"),
            ("VALIDATING", "READY"),
            ("READY", "IN_QUEUE"),
            ("IN_QUEUE", "SCHEDULED"),
            ("SCHEDULED", "RUNNING"),
            ("RUNNING", "COMPLETED")
        ]
        for from_state, to_state in path:
            validate_transition(from_state, to_state, "test")

    def test_running_to_failed(self):
        """CANON-POSITIVE: RUNNING -> FAILED is valid."""
        validate_transition("RUNNING", "FAILED", "test")

    def test_running_to_timeout(self):
        """CANON-POSITIVE: RUNNING -> TIMEOUT is valid."""
        validate_transition("RUNNING", "TIMEOUT", "test")

    def test_failed_has_no_retry_path(self):
        """CANON-NEGATIVE: FAILED cannot go to RETRYING (forbidden)."""
        allowed = CANON_TRANSITIONS.get("FAILED", set())
        self.assertNotIn("RETRYING", allowed)
        # Only CANCELLED is allowed from FAILED
        self.assertEqual(allowed, frozenset(["CANCELLED"]))


class TestTerminalStates(unittest.TestCase):
    """
    Tests terminal states.
    """

    def test_terminal_states_count(self):
        """CANON: 4 terminal states."""
        terminal = {"COMPLETED", "FAILED", "CANCELLED", "TIMEOUT"}
        for state in terminal:
            self.assertEqual(len(CANON_TRANSITIONS.get(state, set()) - {"CANCELLED"}), 0)


class TestBackwardCompatibility(unittest.TestCase):
    """
    Tests backward compatibility aliases.
    """

    def test_ssot_states_equals_canon_states(self):
        """COMPAT: SSOT_STATES == CANON_STATES."""
        self.assertEqual(SSOT_STATES, CANON_STATES)

    def test_ssot_transitions_equals_canon_transitions(self):
        """COMPAT: SSOT_TRANSITIONS == CANON_TRANSITIONS."""
        self.assertEqual(SSOT_TRANSITIONS, CANON_TRANSITIONS)


if __name__ == "__main__":
    unittest.main()