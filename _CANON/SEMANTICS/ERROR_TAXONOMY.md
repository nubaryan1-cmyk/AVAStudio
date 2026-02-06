# AVA — ERROR TAXONOMY (CANON ENFORCEMENT)

**Version:** 1.1  
**Status:** CANON (OWNER APPROVED)  
**Authority:** OWNER DECISION (2025-01-11)  
**Scope:** ERROR CLASSIFICATION — **ENFORCEMENT REQUIRED v1.1+**

---

## 1. CANONICAL ERROR CLASSES (FINAL ENUM)

```
infra | user | model | quota | fatal
```

| Class   | Description                                      | Retryable |
|---------|--------------------------------------------------|-----------|
| `infra` | Infrastructure failure (network, storage, GPU)   | YES       |
| `user`  | User input error (config, dataset, parameters)   | NO        |
| `model` | Model-related error (OOM, convergence, NaN)      | CONDITIONAL |
| `quota` | Resource quota exceeded (time, memory, cost)     | NO        |
| `fatal` | Unrecoverable system error                       | NO        |

---

## 2. CANONICAL ERROR STRUCTURE

```json
{
  "error": {
    "class": "infra | user | model | quota | fatal",
    "code": "STRING (stable identifier)",
    "message": "STRING (human-readable, client-safe)"
  }
}
```

---

## 3. ENFORCEMENT (v1.1+)

### E-ENF-001: Producers MUST Set Error Object
Any job failure MUST have `result.error` as an object with:
- `class`: One of the canonical classes
- `code`: Non-empty stable identifier
- `message`: Human-readable, client-safe description

### E-ENF-002: No Plain String Errors
`result.error` MUST NEVER be a plain string. If legacy code produces a string error, it MUST be wrapped as:
```json
{"class": "fatal", "code": "FATAL_UNCLASSIFIED", "message": "<original string>"}
```

### E-ENF-003: Invalid Class Handling
Consumers MUST reject invalid error classes and map to:
```json
{"class": "fatal", "code": "FATAL_INVALID_ERROR_CLASS", "message": "Unknown error class: <invalid>"}
```

### E-ENF-004: Validation Required
All error objects MUST be validated before storage or transmission.

---

## 4. STABLE ERROR CODE NAMESPACE

| Prefix | Class | Examples |
|--------|-------|----------|
| `INFRA_` | infra | INFRA_TIMEOUT, INFRA_NETWORK_ERROR, INFRA_UPSTREAM_UNAVAILABLE, INFRA_GPU_UNAVAILABLE, INFRA_STORAGE_FULL, INFRA_MISCONFIG |
| `USER_` | user | USER_INVALID_INPUT, USER_UNAUTHORIZED, USER_NOT_FOUND, USER_CONFIG_ERROR, USER_DATASET_ERROR |
| `MODEL_` | model | MODEL_OOM, MODEL_NAN_LOSS, MODEL_CONVERGENCE_FAILED, MODEL_CHECKPOINT_CORRUPT |
| `QUOTA_` | quota | QUOTA_RATE_LIMIT, QUOTA_TIME_EXCEEDED, QUOTA_COST_EXCEEDED, QUOTA_MEMORY_EXCEEDED |
| `FATAL_` | fatal | FATAL_INTERNAL, FATAL_UNCLASSIFIED, FATAL_INVALID_ERROR_CLASS, FATAL_UNSUPPORTED_SSOT_VERSION |

---

## 5. HTTP STATUS CODE MAPPING

| HTTP Status | Error Class | Default Code |
|-------------|-------------|--------------|
| 400, 422 | user | USER_INVALID_INPUT |
| 401, 403 | user | USER_UNAUTHORIZED |
| 404 | user | USER_NOT_FOUND |
| 408, 504 | infra | INFRA_TIMEOUT |
| 429 | quota | QUOTA_RATE_LIMIT |
| 502, 503 | infra | INFRA_UPSTREAM_UNAVAILABLE |
| 500 (default) | fatal | FATAL_INTERNAL |

---

## 6. RELATIONSHIP TO STATE MACHINE

```
ERROR TAXONOMY ≠ STATE TRANSITIONS

- Error class does NOT determine next state
- FAILED is FAILED regardless of error.class
- State machine remains CLOSED (10 states)
- Transitions remain UNCHANGED
```

---

## 7. BACKWARD COMPATIBILITY

- v1.0: Error taxonomy was DECLARATIVE (not enforced)
- v1.1+: Error taxonomy is ENFORCED
- Legacy jobs (v1.0) with string errors are accepted but normalized

---

**END OF ERROR TAXONOMY CANON**
