#!/usr/bin/env python3
"""
AVAStudio SMOKE TEST (v2.0 FINAL)

CANON AUTHORITY: _CANON/STATE_MODEL/STATE_MODEL.txt v2.0 FINAL
CANON STATUS: IMMUTABLE (OWNER APPROVED)
FINAL STATE COUNT: 10
PERMANENTLY FORBIDDEN: PAUSED, RETRYING

This test verifies:
1. Final state count = 10
2. PAUSED and RETRYING are forbidden
3. Valid transitions work
4. No stuck loops
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.ssot_state_validator import (
    CANON_STATES,
    CANON_TRANSITIONS,
    FORBIDDEN_STATES,
    TERMINAL_STATES,
    validate_state,
    validate_transition,
    CanonTransitionViolation
)

results = []

def _pass(name, detail=""):
    """Helper to log pass - renamed to avoid pytest collection."""
    results.append({"name": name, "status": "PASS", "detail": detail})
    print(f"✅ PASS: {name}")

def _fail(name, detail=""):
    """Helper to log fail - renamed to avoid pytest collection."""
    results.append({"name": name, "status": "FAIL", "detail": detail})
    print(f"❌ FAIL: {name} — {detail}")


def test_final_state_count():
    """FINAL STATE COUNT = 10"""
    if len(CANON_STATES) == 10:
        _pass("Final State Count", "10 states")
    else:
        _fail("Final State Count", f"Expected 10, got {len(CANON_STATES)}")


def test_paused_forbidden():
    """PAUSED is PERMANENTLY FORBIDDEN"""
    if "PAUSED" in FORBIDDEN_STATES and "PAUSED" not in CANON_STATES:
        try:
            validate_state("PAUSED", "test")
            _fail("PAUSED Forbidden", "PAUSED was NOT rejected")
        except CanonTransitionViolation:
            _pass("PAUSED Forbidden", "PAUSED rejected correctly")
    else:
        _fail("PAUSED Forbidden", "PAUSED not in FORBIDDEN_STATES")


def test_retrying_forbidden():
    """RETRYING is PERMANENTLY FORBIDDEN"""
    if "RETRYING" in FORBIDDEN_STATES and "RETRYING" not in CANON_STATES:
        try:
            validate_state("RETRYING", "test")
            _fail("RETRYING Forbidden", "RETRYING was NOT rejected")
        except CanonTransitionViolation:
            _pass("RETRYING Forbidden", "RETRYING rejected correctly")
    else:
        _fail("RETRYING Forbidden", "RETRYING not in FORBIDDEN_STATES")


def test_no_stuck_in_queue():
    """IN_QUEUE transitions to SCHEDULED (no stuck loop)"""
    allowed = CANON_TRANSITIONS.get("IN_QUEUE", set())
    if "SCHEDULED" in allowed and "RUNNING" not in allowed:
        _pass("No Stuck IN_QUEUE", "IN_QUEUE → SCHEDULED (correct)")
    else:
        _fail("No Stuck IN_QUEUE", f"Wrong transitions: {allowed}")


def test_full_lifecycle():
    """Full lifecycle CREATED → COMPLETED works"""
    path = [
        ("CREATED", "VALIDATING"),
        ("VALIDATING", "READY"),
        ("READY", "IN_QUEUE"),
        ("IN_QUEUE", "SCHEDULED"),
        ("SCHEDULED", "RUNNING"),
        ("RUNNING", "COMPLETED")
    ]
    errors = []
    for from_state, to_state in path:
        try:
            validate_transition(from_state, to_state, "smoke_test")
        except CanonTransitionViolation:
            errors.append(f"{from_state}→{to_state}")
    
    if not errors:
        _pass("Full Lifecycle", "CREATED → COMPLETED valid")
    else:
        _fail("Full Lifecycle", f"Invalid: {errors}")


def test_failed_no_retry_path():
    """FAILED cannot transition to RETRYING (forbidden)"""
    allowed = CANON_TRANSITIONS.get("FAILED", set())
    if "RETRYING" not in allowed:
        _pass("No Retry Path", "FAILED has no RETRYING transition")
    else:
        _fail("No Retry Path", "FAILED allows RETRYING (BAD)")


def test_terminal_states():
    """4 terminal states exist"""
    expected = {"COMPLETED", "FAILED", "CANCELLED", "TIMEOUT"}
    if TERMINAL_STATES == expected:
        _pass("Terminal States", "4 terminal states")
    else:
        _fail("Terminal States", f"Expected {expected}, got {TERMINAL_STATES}")


def test_cancel_from_any():
    """Most states can cancel"""
    cancellable = ["CREATED", "VALIDATING", "READY", "IN_QUEUE", "SCHEDULED",
                   "RUNNING", "FAILED"]
    errors = []
    for state in cancellable:
        if "CANCELLED" not in CANON_TRANSITIONS.get(state, set()):
            errors.append(state)
    
    if not errors:
        _pass("Cancel From Any", f"{len(cancellable)} states can cancel")
    else:
        _fail("Cancel From Any", f"Cannot cancel from: {errors}")


def main():
    print("=" * 70)
    print("AVASTUDIO SMOKE TEST (v2.0 FINAL)")
    print("CANON: STATE_MODEL.txt v2.0 (IMMUTABLE)")
    print("FINAL STATE COUNT: 10")
    print("FORBIDDEN: PAUSED, RETRYING")
    print("=" * 70)
    print()
    
    test_final_state_count()
    test_paused_forbidden()
    test_retrying_forbidden()
    test_no_stuck_in_queue()
    test_full_lifecycle()
    test_failed_no_retry_path()
    test_terminal_states()
    test_cancel_from_any()
    
    print()
    print("=" * 70)
    
    passed = sum(1 for r in results if r["status"] == "PASS")
    failed = sum(1 for r in results if r["status"] == "FAIL")
    
    print(f"RESULTS: {passed} PASSED, {failed} FAILED")
    
    if failed > 0:
        print("SMOKE TEST: FAILED")
        sys.exit(1)
    else:
        print("SMOKE TEST: PASSED")
        sys.exit(0)


if __name__ == "__main__":
    main()
