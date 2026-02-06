from services.ssot_state_validator import FORBIDDEN_STATES
"""
SSOT INVARIANTS GUARD MODULE (DERIVED ARTIFACT)

================================================================================
THIS FILE IS A DERIVED ARTIFACT — NOT AN INDEPENDENT AUTHORITY
================================================================================

CANON AUTHORITY: _CANON/STATE_MODEL/STATE_MODEL.txt (SOLE & PERMANENT)
CANON VERSION: 2.0 (FINAL)
CANON STATUS: IMMUTABLE (OWNER APPROVED)

FINAL STATE COUNT: 10
PERMANENTLY FORBIDDEN: PAUSED, RETRYING

This file IMPLEMENTS guards based on STATE_MODEL.txt.
DO NOT MODIFY the state/transition definitions manually.
================================================================================
"""

from typing import Any, Dict, Set

# =============================================================================
# CANONICAL DEFINITIONS (from _CANON/STATE_MODEL/STATE_MODEL.txt v2.0 FINAL)
# =============================================================================

CANON_STATES: Set[str] = frozenset([
    "CREATED",
    "VALIDATING",
    "READY",
    "IN_QUEUE",
    "SCHEDULED",
    "RUNNING",
    "COMPLETED",
    "FAILED",
    "CANCELLED",
    "TIMEOUT"
])

# PERMANENTLY FORBIDDEN STATES
FORBIDDEN_STATES: Set[str] = frozenset([
])

CANON_TRANSITIONS: Dict[str, Set[str]] = {
    "CREATED": frozenset(["VALIDATING", "CANCELLED"]),
    "VALIDATING": frozenset(["READY", "FAILED", "CANCELLED"]),
    "READY": frozenset(["IN_QUEUE", "CANCELLED"]),
    "IN_QUEUE": frozenset(["SCHEDULED", "CANCELLED"]),
    "SCHEDULED": frozenset(["RUNNING", "CANCELLED"]),
    "RUNNING": frozenset(["COMPLETED", "FAILED", "TIMEOUT", "CANCELLED"]),
    "COMPLETED": frozenset(),
    "FAILED": frozenset(["CANCELLED"]),
    "CANCELLED": frozenset(),
    "TIMEOUT": frozenset()
}

# Backward compatibility aliases
SSOT_STATES = CANON_STATES
SSOT_TRANSITIONS = CANON_TRANSITIONS

# =============================================================================
# JOB CONTRACT FIELDS (from _CANON/JOB_CONTRACT/job_contract.json)
# =============================================================================

CANON_CONTRACT_ROOT_FIELDS: Set[str] = frozenset([
    "job_id", "job_type", "state", "ssot_version", "correlation_id", "user_id",
    "timestamps", "payload", "progress", "result"
])

CANON_CONTRACT_TIMESTAMPS_FIELDS: Set[str] = frozenset(["created", "started", "finished"])
CANON_CONTRACT_PROGRESS_FIELDS: Set[str] = frozenset(["percent", "step", "total", "message"])
CANON_CONTRACT_RESULT_FIELDS: Set[str] = frozenset(["artifacts", "metrics", "error"])
CANON_CONTRACT_PAYLOAD_FIELDS: Set[str] = frozenset(["dataset", "training", "lora", "inference", "generation"])

# Backward compatibility aliases
SSOT_CONTRACT_ROOT_FIELDS = CANON_CONTRACT_ROOT_FIELDS
SSOT_CONTRACT_TIMESTAMPS_FIELDS = CANON_CONTRACT_TIMESTAMPS_FIELDS
SSOT_CONTRACT_PROGRESS_FIELDS = CANON_CONTRACT_PROGRESS_FIELDS
SSOT_CONTRACT_RESULT_FIELDS = CANON_CONTRACT_RESULT_FIELDS
SSOT_CONTRACT_PAYLOAD_FIELDS = CANON_CONTRACT_PAYLOAD_FIELDS

TERMINAL_STATES: Set[str] = frozenset(["COMPLETED", "FAILED", "CANCELLED", "TIMEOUT"])


# =============================================================================
# INVARIANT VIOLATION EXCEPTION
# =============================================================================

class CanonInvariantViolation(Exception):
    """
    Deterministic CANON invariant violation.
    Authority: _CANON/STATE_MODEL/STATE_MODEL.txt
    """
    def __init__(
        self,
        error_code: str,
        invariant_id: str,
        canon_ref: str,
        location: str,
        offending_value: Any,
        expected: Any
    ):
        self.error_code = error_code
        self.invariant_id = invariant_id
        self.canon_ref = canon_ref
        self.location = location
        self.offending_value = offending_value
        self.expected = expected
        super().__init__(self._format())

    def _format(self) -> str:
        return (
            f"error_code={self.error_code} "
            f"invariant_id={self.invariant_id} "
            f"canon_ref={self.canon_ref} "
            f"location={self.location} "
            f"offending_value={self.offending_value} "
            f"expected={self.expected}"
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_code": self.error_code,
            "invariant_id": self.invariant_id,
            "canon_ref": self.canon_ref,
            "location": self.location,
            "offending_value": self.offending_value,
            "expected": self.expected
        }


# Backward compatibility alias
SSOTInvariantViolation = CanonInvariantViolation


# =============================================================================
# GUARD FUNCTIONS
# =============================================================================

def guard_validate_state(state: str, location: str) -> None:
    """
    INV-001: State must be in CANON_STATES and NOT in FORBIDDEN_STATES.
    Canon Ref: _CANON/STATE_MODEL/STATE_MODEL.txt v2.0 FINAL
    """
    if state in FORBIDDEN_STATES:
        raise CanonInvariantViolation(
            error_code="CANON_INVARIANT_VIOLATION",
            invariant_id="INV-001-FORBIDDEN",
            canon_ref="_CANON/STATE_MODEL/STATE_MODEL.txt",
            location=location,
            offending_value=state,
            expected=f"NOT in FORBIDDEN: {sorted(FORBIDDEN_STATES)}"
        )
    
    if state not in CANON_STATES:
        raise CanonInvariantViolation(
            error_code="CANON_INVARIANT_VIOLATION",
            invariant_id="INV-001",
            canon_ref="_CANON/STATE_MODEL/STATE_MODEL.txt",
            location=location,
            offending_value=state,
            expected=sorted(CANON_STATES)
        )


def guard_validate_transition(from_state: str, to_state: str, location: str) -> None:
    """
    INV-002: Transition (from_state -> to_state) must exist in CANON_TRANSITIONS.
    Canon Ref: _CANON/STATE_MODEL/STATE_TRANSITIONS.txt v2.0 FINAL
    """
    guard_validate_state(from_state, location)
    guard_validate_state(to_state, location)

    allowed = CANON_TRANSITIONS.get(from_state, frozenset())
    if to_state not in allowed:
        raise CanonInvariantViolation(
            error_code="CANON_INVARIANT_VIOLATION",
            invariant_id="INV-002",
            canon_ref="_CANON/STATE_MODEL/STATE_TRANSITIONS.txt",
            location=location,
            offending_value=f"{from_state}->{to_state}",
            expected=sorted(allowed) if allowed else "TERMINAL (no transitions)"
        )


def guard_validate_contract_fields(contract: Dict[str, Any], location: str) -> None:
    """
    INV-003: Contract must contain ONLY fields defined in Canon Job-Contract.
    Unknown fields are rejected.
    Canon Ref: _CANON/JOB_CONTRACT/job_contract.json
    """
    root_keys = set(contract.keys())
    unknown_root = root_keys - CANON_CONTRACT_ROOT_FIELDS
    if unknown_root:
        raise CanonInvariantViolation(
            error_code="CANON_INVARIANT_VIOLATION",
            invariant_id="INV-003",
            canon_ref="_CANON/JOB_CONTRACT/job_contract.json:root",
            location=location,
            offending_value=sorted(unknown_root),
            expected=sorted(CANON_CONTRACT_ROOT_FIELDS)
        )


def guard_validate_contract_required(contract: Dict[str, Any], location: str) -> None:
    """
    INV-004: Contract must contain required fields: job_id, state.
    Canon Ref: _CANON/JOB_CONTRACT/job_contract.json
    """
    required = ["job_id", "state"]
    missing = [f for f in required if f not in contract]
    if missing:
        raise CanonInvariantViolation(
            error_code="CANON_INVARIANT_VIOLATION",
            invariant_id="INV-004",
            canon_ref="_CANON/JOB_CONTRACT/job_contract.json",
            location=location,
            offending_value=f"missing:{missing}",
            expected=required
        )


def guard_validate_contract_state(contract: Dict[str, Any], location: str) -> None:
    """
    INV-005: Contract.state must be valid Canon state (not FORBIDDEN).
    Canon Ref: _CANON/STATE_MODEL/STATE_MODEL.txt v2.0 FINAL
    """
    if "state" in contract:
        guard_validate_state(contract["state"], location)


def is_terminal_state(state: str) -> bool:
    """Check if state is terminal (no outgoing transitions)."""
    return state in TERMINAL_STATES
