"""
AVA SCHEMA VALIDATOR

================================================================================
Validates payloads against canonical JSON schemas.
================================================================================
"""

import os
import json
from typing import Dict, Any, List, Optional
from functools import lru_cache

try:
    import jsonschema
    from jsonschema import validate, ValidationError
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False


# =============================================================================
# SCHEMA LOADING
# =============================================================================

def _get_schema_root() -> str:
    """Get _CANON/SCHEMAS directory path."""
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    canon = os.path.join(os.path.dirname(base), "_CANON", "SCHEMAS")
    if os.path.exists(canon):
        return canon
    return os.path.join(base, "_CANON", "SCHEMAS")


@lru_cache(maxsize=10)
def load_schema(schema_name: str) -> Optional[Dict[str, Any]]:
    """Load JSON schema by name."""
    path = os.path.join(_get_schema_root(), schema_name)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# =============================================================================
# JOB TYPE TO SCHEMA MAPPING
# =============================================================================

JOB_TYPE_SCHEMAS = {
    "photo.generate": "payload_photo_generate.v1.schema.json",
    "video.generate": "payload_video_generate.v1.schema.json",
    "lora.train": "payload_lora_train.v1.schema.json",
    "lora.infer": "payload_lora_infer.v1.schema.json",
    "train_lora": "payload_lora_train.v1.schema.json",  # Legacy
}


# =============================================================================
# VALIDATION
# =============================================================================

def validate_payload(job_type: str, payload: Dict[str, Any]) -> List[str]:
    """
    Validate payload against job type schema.
    
    Returns list of errors (empty if valid).
    """
    errors = []
    
    # Check job type
    schema_name = JOB_TYPE_SCHEMAS.get(job_type)
    if not schema_name:
        errors.append(f"Unknown job type: {job_type}")
        return errors
    
    # Load schema
    schema = load_schema(schema_name)
    if not schema:
        errors.append(f"Schema not found: {schema_name}")
        return errors
    
    # Validate if jsonschema available
    if HAS_JSONSCHEMA:
        try:
            validate(instance=payload, schema=schema)
        except ValidationError as e:
            errors.append(f"{e.json_path}: {e.message}")
        except Exception as e:
            errors.append(f"Validation error: {str(e)[:200]}")
    else:
        # Basic validation without jsonschema
        required = schema.get("required", [])
        for field in required:
            if field not in payload:
                errors.append(f"Missing required field: {field}")
    
    return errors


def validate_job_contract(job: Dict[str, Any]) -> List[str]:
    """
    Validate job contract structure.
    """
    schema = load_schema("job_contract.v1.schema.json")
    if not schema:
        return ["Job contract schema not found"]
    
    errors = []
    
    if HAS_JSONSCHEMA:
        try:
            validate(instance=job, schema=schema)
        except ValidationError as e:
            errors.append(f"{e.json_path}: {e.message}")
        except Exception as e:
            errors.append(f"Validation error: {str(e)[:200]}")
    else:
        # Basic validation
        required = ["job_id", "job_type", "state", "ssot_version", "timestamps", "payload", "progress", "result"]
        for field in required:
            if field not in job:
                errors.append(f"Missing required field: {field}")
    
    return errors
