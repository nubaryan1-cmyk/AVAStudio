"""
AVA OBSERVABILITY SERVICE

================================================================================
CANON: _CANON/SEMANTICS/OBSERVABILITY.v1.md
================================================================================

Provides:
- correlation_id generation and propagation
- Structured logging
- Prometheus metrics
"""

import os
import time
import json
import uuid
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from contextlib import contextmanager
import threading

try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
    HAS_PROMETHEUS = True
except ImportError:
    HAS_PROMETHEUS = False

from services.config import get_config


# =============================================================================
# CORRELATION ID
# =============================================================================

# Thread-local storage for correlation_id
_context = threading.local()


def generate_correlation_id() -> str:
    """Generate new correlation ID."""
    return str(uuid.uuid4())


def get_correlation_id() -> Optional[str]:
    """Get current correlation ID from context."""
    return getattr(_context, "correlation_id", None)


def set_correlation_id(correlation_id: str) -> None:
    """Set correlation ID in context."""
    _context.correlation_id = correlation_id


@contextmanager
def correlation_context(correlation_id: Optional[str] = None):
    """
    Context manager for correlation ID.
    
    Usage:
        with correlation_context("abc-123"):
            # All logs within this context will have correlation_id
            log_event("job_started", job_id="123")
    """
    old_id = get_correlation_id()
    set_correlation_id(correlation_id or generate_correlation_id())
    try:
        yield get_correlation_id()
    finally:
        if old_id:
            set_correlation_id(old_id)
        else:
            _context.correlation_id = None


# =============================================================================
# STRUCTURED LOGGER
# =============================================================================

class StructuredLogger:
    """
    Structured JSON logger.
    """
    
    LOG_LEVELS = {
        "DEBUG": 10,
        "INFO": 20,
        "WARN": 30,
        "ERR": 40
    }
    
    def __init__(self):
        self.config = get_config()
        self.min_level = self.LOG_LEVELS.get(self.config.log_level, 20)
        self.output_file = os.getenv(
            "AVA_STRUCTURED_LOG",
            os.path.join(os.getenv("AVA_STORAGE_ROOT", "/tmp/ava_storage"), "structured.jsonl")
        )
        os.makedirs(os.path.dirname(self.output_file), exist_ok=True)
    
    def _should_log(self, level: str) -> bool:
        return self.LOG_LEVELS.get(level, 20) >= self.min_level
    
    def log(
        self,
        level: str,
        event: str,
        message: str = "",
        **kwargs
    ) -> None:
        """Write structured log entry."""
        if not self._should_log(level):
            return
        
        entry = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "event": event,
            "env": self.config.env.value,
            "correlation_id": get_correlation_id(),
            "message": message
        }
        entry.update(kwargs)
        
        # Write to file
        with open(self.output_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        
        # Also write to stdout
        print(json.dumps(entry, ensure_ascii=False))
    
    def debug(self, event: str, message: str = "", **kwargs):
        self.log("DEBUG", event, message, **kwargs)
    
    def info(self, event: str, message: str = "", **kwargs):
        self.log("INFO", event, message, **kwargs)
    
    def warn(self, event: str, message: str = "", **kwargs):
        self.log("WARN", event, message, **kwargs)
    
    def error(self, event: str, message: str = "", **kwargs):
        self.log("ERR", event, message, **kwargs)


# Singleton logger
_logger: Optional[StructuredLogger] = None

def get_logger() -> StructuredLogger:
    global _logger
    if _logger is None:
        _logger = StructuredLogger()
    return _logger


def log_event(event: str, level: str = "INFO", message: str = "", **kwargs):
    """Convenience function for logging."""
    get_logger().log(level, event, message, **kwargs)


# =============================================================================
# PROMETHEUS METRICS
# =============================================================================

if HAS_PROMETHEUS:
    # Counters
    JOBS_TOTAL = Counter(
        "ava_jobs_total",
        "Total number of jobs",
        ["job_type", "state", "provider"]
    )
    
    REQUESTS_TOTAL = Counter(
        "ava_requests_total",
        "Total API requests",
        ["endpoint", "method", "status"]
    )
    
    ERRORS_TOTAL = Counter(
        "ava_errors_total",
        "Total errors",
        ["error_class", "error_code"]
    )
    
    # Histograms
    JOB_DURATION = Histogram(
        "ava_job_duration_seconds",
        "Job execution duration",
        ["job_type", "provider"],
        buckets=[1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600]
    )
    
    REQUEST_DURATION = Histogram(
        "ava_request_duration_seconds",
        "API request duration",
        ["endpoint"],
        buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    )
    
    # Gauges
    QUEUE_DEPTH = Gauge(
        "ava_queue_depth",
        "Current queue depth",
        ["job_type"]
    )
    
    ACTIVE_JOBS = Gauge(
        "ava_active_jobs",
        "Currently running jobs",
        ["job_type"]
    )
    
    GPU_SLOTS_AVAILABLE = Gauge(
        "ava_gpu_slots_available",
        "Available GPU slots"
    )


class MetricsCollector:
    """
    Metrics collection helper.
    """
    
    def __init__(self):
        self.enabled = get_config().metrics_enabled and HAS_PROMETHEUS
    
    def record_job(self, job_type: str, state: str, provider: str = "gpu"):
        if self.enabled:
            JOBS_TOTAL.labels(job_type=job_type, state=state, provider=provider).inc()
    
    def record_request(self, endpoint: str, method: str, status: int):
        if self.enabled:
            REQUESTS_TOTAL.labels(endpoint=endpoint, method=method, status=str(status)).inc()
    
    def record_error(self, error_class: str, error_code: str):
        if self.enabled:
            ERRORS_TOTAL.labels(error_class=error_class, error_code=error_code).inc()
    
    def record_job_duration(self, job_type: str, duration_seconds: float, provider: str = "gpu"):
        if self.enabled:
            JOB_DURATION.labels(job_type=job_type, provider=provider).observe(duration_seconds)
    
    def record_request_duration(self, endpoint: str, duration_seconds: float):
        if self.enabled:
            REQUEST_DURATION.labels(endpoint=endpoint).observe(duration_seconds)
    
    def set_queue_depth(self, job_type: str, depth: int):
        if self.enabled:
            QUEUE_DEPTH.labels(job_type=job_type).set(depth)
    
    def set_active_jobs(self, job_type: str, count: int):
        if self.enabled:
            ACTIVE_JOBS.labels(job_type=job_type).set(count)
    
    def set_gpu_slots(self, available: int):
        if self.enabled:
            GPU_SLOTS_AVAILABLE.set(available)
    
    def get_metrics(self) -> bytes:
        """Get Prometheus metrics output."""
        if HAS_PROMETHEUS:
            return generate_latest()
        return b""
    
    @property
    def content_type(self) -> str:
        if HAS_PROMETHEUS:
            return CONTENT_TYPE_LATEST
        return "text/plain"


# Singleton
_metrics: Optional[MetricsCollector] = None

def get_metrics() -> MetricsCollector:
    global _metrics
    if _metrics is None:
        _metrics = MetricsCollector()
    return _metrics
