AVA JOB REGISTRY — CANONICAL STORAGE

This file stores the authoritative state of all jobs in AVA.

RULES:
- One job = one record
- job_id is immutable
- state MUST follow _CANON/STATE_MODEL
- reason is mandatory for FAILED / CANCELLED
- PAUSED and RETRYING are PERMANENTLY FORBIDDEN
- This storage is executor-agnostic (RunPod, local, cloud)

DO NOT:
- overwrite whole file blindly
- invent new states
- modify structure without canon update
