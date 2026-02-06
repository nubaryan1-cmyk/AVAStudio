# AVA — OBSERVABILITY SPEC (CANON)

**Version:** 1.0  
**Status:** CANON (OWNER APPROVED)  
**Authority:** _CANON/SEMANTICS/OBSERVABILITY.v1.md  
**Scope:** LOGGING, TRACING & METRICS

---

## 1. CORRELATION ID

### Purpose

Unique identifier that traces a request through the entire system.

### Format

```
correlation_id: UUID v4

Example: 550e8400-e29b-41d4-a716-446655440000
```

### Propagation Rules

1. **O-001:** correlation_id MUST be generated at API entry point
2. **O-002:** correlation_id MUST be stored in job record
3. **O-003:** correlation_id MUST be included in all log entries for that job
4. **O-004:** correlation_id MUST be returned in API responses

---

## 2. STRUCTURED LOGGING FORMAT

### Required Fields

```json
{
  "ts": "2025-01-12T12:00:00.000Z",
  "level": "INFO | WARN | ERROR | DEBUG",
  "event": "job_created | job_started | job_completed | ...",
  "job_id": "uuid",
  "correlation_id": "uuid",
  "user_id": "string",
  "env": "PROD | STAGING",
  "message": "Human readable description"
}
```

### Optional Context Fields

```json
{
  "job_type": "photo.generate",
  "state": "RUNNING",
  "duration_ms": 1234,
  "error_code": "INFRA_TIMEOUT",
  "provider": "flux",
  "model": "flux-dev"
}
```

---

## 3. LOG EVENTS (CANONICAL)

| Event | Level | Description |
|-------|-------|-------------|
| job_created | INFO | Job record created |
| job_validating | INFO | Payload validation started |
| job_ready | INFO | Validation passed |
| job_enqueued | INFO | Added to queue |
| job_scheduled | INFO | Assigned to worker |
| job_started | INFO | Execution started |
| job_progress | DEBUG | Progress update |
| job_completed | INFO | Success |
| job_failed | ERROR | Failure |
| job_cancelled | WARN | Cancelled by user |
| job_timeout | WARN | Timeout |
| auth_success | INFO | Authentication successful |
| auth_failed | WARN | Authentication failed |
| rate_limited | WARN | Rate limit exceeded |
| quota_exceeded | WARN | Quota exceeded |
| provider_fallback | WARN | Fallback to SaaS provider |
| provider_error | ERROR | Provider returned error |

---

## 4. METRICS (PROMETHEUS FORMAT)

### Counter Metrics

```
ava_jobs_total{job_type, state, provider} - Total jobs by type/state/provider
ava_requests_total{endpoint, method, status} - API requests
ava_errors_total{error_class, error_code} - Errors by class/code
```

### Histogram Metrics

```
ava_job_duration_seconds{job_type, provider} - Job execution time
ava_request_duration_seconds{endpoint} - API request latency
ava_queue_wait_seconds{job_type} - Queue wait time
```

### Gauge Metrics

```
ava_queue_depth{job_type} - Current queue depth
ava_active_jobs{job_type} - Currently running jobs
ava_gpu_slots_available - Available GPU slots
```

---

## 5. /metrics ENDPOINT

### Path

```
GET /metrics
GET /api/v1/metrics
```

### Response Format

```
# HELP ava_jobs_total Total number of jobs
# TYPE ava_jobs_total counter
ava_jobs_total{job_type="photo.generate",state="COMPLETED",provider="flux"} 1234

# HELP ava_job_duration_seconds Job execution duration
# TYPE ava_job_duration_seconds histogram
ava_job_duration_seconds_bucket{job_type="photo.generate",le="1.0"} 100
ava_job_duration_seconds_bucket{job_type="photo.generate",le="5.0"} 450
```

---

## 6. ENVIRONMENT-SPECIFIC BEHAVIOR

| Aspect | PROD | STAGING |
|--------|------|---------|
| Log level | INFO | DEBUG |
| Log destination | CloudWatch/stdout | stdout |
| Metrics endpoint | Enabled | Enabled |
| Sensitive data | Redacted | Visible (debug) |

---

**END OF OBSERVABILITY CANON**
