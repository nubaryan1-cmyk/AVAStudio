AVA — KOHYA_SS ADAPTER

This adapter launches kohya_ss training as an EXECUTOR.

RULES:
- Adapter does NOT own job state
- Adapter MUST use job_state_writer.ps1
- Adapter reports only:
  RUNNING / COMPLETED / FAILED
- Adapter NEVER changes state directly

INPUT:
- job_id
- config_path

OUTPUT:
- checkpoints
- logs
