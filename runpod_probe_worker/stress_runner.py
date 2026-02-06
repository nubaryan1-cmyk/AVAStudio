#!/usr/bin/env python3
"""
AVA CANON STRESS RUNNER (IRONCLAD)

Runs 2000+ iterations with concurrency to prove:
- 0 crashes
- 0 string errors
- 0 invalid classes
- 0 forbidden states

Usage:
    python stress_runner.py --n 2000 --concurrency 64
"""

import sys
import os
import argparse
import time
import random
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import List, Dict, Any

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.error_taxonomy import (
    normalize_error,
    classify_exception,
    validate_error_obj,
    CANON_ERROR_CLASSES,
    InvalidErrorObjectError
)
from services.ssot_versioning import (
    normalize_ssot_version,
    validate_ssot_version,
    process_job_intake,
    UnsupportedSsotVersionError,
    DEFAULT_SSOT_VERSION,
    CURRENT_SSOT_VERSION
)
from services.ssot_state_validator import (
    CANON_STATES,
    FORBIDDEN_STATES,
    validate_state,
    validate_transition,
    CanonTransitionViolation
)


@dataclass
class StressStats:
    """Statistics for stress run."""
    total_iterations: int = 0
    successful_jobs: int = 0
    failed_jobs: int = 0
    crashes: int = 0
    string_errors: int = 0
    invalid_classes: int = 0
    forbidden_states_accepted: int = 0
    errors: List[str] = field(default_factory=list)
    lock: threading.Lock = field(default_factory=threading.Lock)
    
    def record_success(self):
        with self.lock:
            self.total_iterations += 1
            self.successful_jobs += 1
    
    def record_fail(self):
        with self.lock:
            self.total_iterations += 1
            self.failed_jobs += 1
    
    def record_crash(self, msg: str):
        with self.lock:
            self.total_iterations += 1
            self.crashes += 1
            self.errors.append(f"CRASH: {msg}")
    
    def record_string_error(self, msg: str):
        with self.lock:
            self.string_errors += 1
            self.errors.append(f"STRING_ERROR: {msg}")
    
    def record_invalid_class(self, msg: str):
        with self.lock:
            self.invalid_classes += 1
            self.errors.append(f"INVALID_CLASS: {msg}")
    
    def record_forbidden_state(self, msg: str):
        with self.lock:
            self.forbidden_states_accepted += 1
            self.errors.append(f"FORBIDDEN_STATE: {msg}")


def random_version() -> str:
    """Generate random version string."""
    choices = [
        "1.0", "1.1",  # Valid
        "2.0", "9.0", "99.0",  # Invalid major
        "abc", "1", "1.0.0", "",  # Invalid format
        None,  # Missing
    ]
    return random.choice(choices)


def random_error_input():
    """Generate random error input."""
    choices = [
        "string error",
        {"class": "user", "code": "TEST", "message": "test"},
        {"class": "fatal", "code": "FATAL_INTERNAL", "message": "internal"},
        {"class": "infra", "code": "INFRA_TIMEOUT", "message": "timeout"},
        {"class": "invalid_class", "code": "BAD", "message": "bad"},
        {"class": "", "code": "EMPTY", "message": "empty"},
        None,
        12345,
        ["list", "error"],
        RuntimeError("exception"),
        ValueError("value error"),
    ]
    return random.choice(choices)


def stress_iteration(iteration_id: int, stats: StressStats):
    """Run a single stress iteration."""
    try:
        # === SSOT VERSIONING TEST ===
        version = random_version()
        job = {"job_id": f"stress-{iteration_id}", "state": "CREATED"}
        if version is not None:
            job["ssot_version"] = version
        
        processed, success = process_job_intake(job)
        
        # Validate result
        if processed is None:
            stats.record_crash(f"iteration {iteration_id}: process_job_intake returned None")
            return
        
        if not success:
            # Failed job - check error is canonical
            error = processed.get("result", {}).get("error")
            if error is None:
                stats.record_crash(f"iteration {iteration_id}: failed job has no error")
                return
            if isinstance(error, str):
                stats.record_string_error(f"iteration {iteration_id}: error is string: {error[:50]}")
                return
            if error.get("class") not in CANON_ERROR_CLASSES:
                stats.record_invalid_class(f"iteration {iteration_id}: invalid class: {error.get('class')}")
                return
        
        # === ERROR TAXONOMY TEST ===
        error_input = random_error_input()
        error_output = normalize_error(error_input)
        
        if error_input is not None:
            if not isinstance(error_output, dict):
                stats.record_crash(f"iteration {iteration_id}: error_output not dict")
                return
            if error_output.get("class") not in CANON_ERROR_CLASSES:
                stats.record_invalid_class(f"iteration {iteration_id}: normalized error invalid class: {error_output.get('class')}")
                return
        
        # === STATE VALIDATION TEST ===
        # Test that forbidden states are rejected
        forbidden = random.choice(list(FORBIDDEN_STATES))
        try:
            validate_state(forbidden, f"stress:{iteration_id}")
            stats.record_forbidden_state(f"iteration {iteration_id}: {forbidden} was accepted")
            return
        except CanonTransitionViolation:
            pass  # Expected
        
        # Test that valid states are accepted
        valid_state = random.choice(list(CANON_STATES))
        try:
            validate_state(valid_state, f"stress:{iteration_id}")
        except CanonTransitionViolation:
            stats.record_crash(f"iteration {iteration_id}: valid state {valid_state} was rejected")
            return
        
        # All checks passed
        if success:
            stats.record_success()
        else:
            stats.record_fail()
        
    except Exception as e:
        stats.record_crash(f"iteration {iteration_id}: unhandled exception: {type(e).__name__}: {str(e)[:100]}")


def run_stress(n: int, concurrency: int) -> StressStats:
    """Run stress test with given parameters."""
    stats = StressStats()
    
    print(f"Starting stress test: n={n}, concurrency={concurrency}")
    print("-" * 60)
    
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [executor.submit(stress_iteration, i, stats) for i in range(n)]
        
        completed = 0
        for future in as_completed(futures):
            completed += 1
            if completed % 500 == 0:
                print(f"  Progress: {completed}/{n} ({100*completed//n}%)")
    
    duration = time.time() - start_time
    
    print("-" * 60)
    print(f"Completed in {duration:.2f} seconds")
    print(f"Rate: {n/duration:.1f} iterations/second")
    
    return stats, duration


def print_report(stats: StressStats, duration: float, n: int, concurrency: int):
    """Print stress test report."""
    print()
    print("=" * 60)
    print("STRESS TEST REPORT")
    print("=" * 60)
    print()
    print(f"Parameters:")
    print(f"  Iterations:  {n}")
    print(f"  Concurrency: {concurrency}")
    print(f"  Duration:    {duration:.2f}s")
    print()
    print(f"Results:")
    print(f"  Total iterations:          {stats.total_iterations}")
    print(f"  Successful jobs:           {stats.successful_jobs}")
    print(f"  Failed jobs (expected):    {stats.failed_jobs}")
    print()
    print(f"Violations (must be 0):")
    print(f"  Crashes:                   {stats.crashes}")
    print(f"  String errors:             {stats.string_errors}")
    print(f"  Invalid classes:           {stats.invalid_classes}")
    print(f"  Forbidden states accepted: {stats.forbidden_states_accepted}")
    print()
    
    total_violations = stats.crashes + stats.string_errors + stats.invalid_classes + stats.forbidden_states_accepted
    
    if stats.errors:
        print("Errors (first 10):")
        for err in stats.errors[:10]:
            print(f"  - {err}")
        print()
    
    print("=" * 60)
    if total_violations == 0:
        print("✅ STRESS TEST: PASSED")
        print("   0 crashes, 0 string errors, 0 invalid classes, 0 forbidden states")
    else:
        print("❌ STRESS TEST: FAILED")
        print(f"   {total_violations} total violations")
    print("=" * 60)
    
    return total_violations == 0


def main():
    parser = argparse.ArgumentParser(description="AVA Canon Stress Runner")
    parser.add_argument("--n", type=int, default=2000, help="Number of iterations")
    parser.add_argument("--concurrency", type=int, default=64, help="Concurrency level")
    args = parser.parse_args()
    
    stats, duration = run_stress(args.n, args.concurrency)
    success = print_report(stats, duration, args.n, args.concurrency)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
