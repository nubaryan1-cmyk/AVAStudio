# AVA — SSOT VERSIONING (CANON POLICY)

**Version:** 1.0  
**Status:** CANON (OWNER APPROVED)  
**Authority:** OWNER DECISION (2025-01-11)  
**Scope:** CONTRACT VERSION MANAGEMENT

---

## 1. VERSION FORMAT (CANONICAL)

```
ssot_version: "MAJOR.MINOR"
```

Examples: `"1.0"`, `"1.1"`, `"2.0"`

---

## 2. CURRENT VERSION

```
Contract Version: 1.1
State Machine Version: 2.0 (FINAL, CLOSED)
```

---

## 2.1 VERSION CHANGELOG

| Version | Changes |
|---------|---------|
| 1.0 | Initial contract (error taxonomy declarative) |
| 1.1 | ERROR_TAXONOMY enforcement mandatory |

---

## 3. VERSION SEMANTICS (CANONICAL RULES)

### v1.x — Backward Compatible (Additive Only)
- **V-001:** Minor versions (1.0 → 1.1) are ADDITIVE ONLY
- **V-002:** No field removal, no field renaming, no meaning changes
- **V-003:** Consumers MUST tolerate missing additive fields
- **V-004:** No migration required between v1.x versions

### v2.0 — Breaking Changes Allowed
- **V-005:** Major version (1.x → 2.0) MAY introduce breaking changes
- **V-006:** Breaking changes include:
  - Removing or renaming fields
  - Changing field meaning or requiredness
  - Changing state list or transition legality
  - Changing SSOT semantic interpretation

---

## 4. MISSING VERSION HANDLING (CANONICAL)

- **V-010:** If `ssot_version` is missing in job_contract → **default to "1.0"**
- **V-011:** If `ssot_version` is unknown/unsupported → classify error as:
  ```
  error.class: "fatal"
  error.code: "UNSUPPORTED_SSOT_VERSION"
  ```
- **V-012:** Executors MUST reject jobs with unsupported major versions

---

## 5. MIGRATION POLICY (CANONICAL)

### v1.x Migrations
- **M-001:** No migration required between v1.0 and v1.1
- **M-002:** Consumers must handle missing additive fields gracefully
- **M-003:** Default values applied for absent optional fields

### v2.0 Migrations
- **M-010:** v2.0 requires explicit migration path
- **M-011:** v1.x jobs MUST remain processable during transition period
- **M-012:** Migration scripts MUST be provided before v2.0 rollout

---

## 6. API VERSIONING ALIGNMENT (CANONICAL)

### Path-Based Versioning
- **API-001:** v1.x APIs served at `/api/v1/*`
- **API-002:** v2.0 APIs served at `/api/v2/*`
- **API-003:** `/api/v1/*` MUST remain stable and supported
- **API-004:** New major version requires new path, not replacement

### Compatibility Matrix

| SSOT Version | API Path | Status |
|--------------|----------|--------|
| 1.0 | `/api/v1/*` | STABLE |
| 1.1 | `/api/v1/*` | STABLE (additive) |
| 2.0 | `/api/v2/*` | FUTURE (breaking) |

---

## 7. BREAKING CHANGE DEFINITION (CANONICAL)

A change is BREAKING if it:
1. Removes a field from job_contract
2. Renames a field in job_contract
3. Changes the type of a field
4. Changes requiredness (optional → required)
5. Changes semantic meaning of a field
6. Adds/removes states from STATE_MODEL
7. Changes transition legality in STATE_TRANSITIONS
8. Changes error taxonomy class meanings

---

## 8. CANON HIERARCHY

```
PRIMARY LAW:     AVAStudio_SSOT_CORRECTED.xlsx
                        ↓
STATE CANON:     _CANON/STATE_MODEL/STATE_MODEL.txt (v2.0 FINAL, CLOSED)
                        ↓
CONTRACT CANON:  _CANON/JOB_CONTRACT/job_contract.json (v1.0)
                        ↓
VERSIONING:      _CANON/SEMANTICS/SSOT_VERSIONING.md (THIS FILE)
```

---

**END OF SSOT VERSIONING CANON**
