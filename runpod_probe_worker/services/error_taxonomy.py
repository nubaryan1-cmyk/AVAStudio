"""
ERROR TAXONOMY ENFORCEMENT SERVICE

================================================================================
CANON AUTHORITY: _CANON/SEMANTICS/ERROR_TAXONOMY.md v1.1
STATUS: ENFORCEMENT REQUIRED (v1.1+)
================================================================================

This module provides canonical error classification and normalization.
All job failures MUST use this module to ensure compliance.
"""

from typing import Any, Dict, Optional, Union

# =============================================================================
# CANONICAL ERROR CLASSES (from ERROR_TAXONOMY.md)
# =============================================================================

CANON_ERROR_CLASSES = frozenset(["infra", "user", "model", "quota", "fatal"])

# =============================================================================
# STABLE ERROR CODES
# =============================================================================

ERROR_CODES = {
    # Infrastructure errors
    "INFRA_TIMEOUT": ("infra", "Operation timed out"),
    "INFRA_NETWORK_ERROR": ("infra", "Network communication failed"),
    "INFRA_UPSTREAM_UNAVAILABLE": ("infra", "Upstream service unavailable"),
    "INFRA_GPU_UNAVAILABLE": ("infra", "GPU resource not available"),
    "INFRA_STORAGE_FULL": ("infra", "Storage capacity exceeded"),
    "INFRA_MISCONFIG": ("infra", "Infrastructure misconfiguration"),
    
    # User errors
    "USER_INVALID_INPUT": ("user", "Invalid input provided"),
    "USER_UNAUTHORIZED": ("user", "Authentication required"),
    "USER_NOT_FOUND": ("user", "Resource not found"),
    "USER_CONFIG_ERROR": ("user", "Configuration error"),
    "USER_DATASET_ERROR": ("user", "Dataset validation failed"),
    
    # Model errors
    "MODEL_OOM": ("model", "GPU out of memory"),
    "MODEL_NAN_LOSS": ("model", "Training loss became NaN"),
    "MODEL_CONVERGENCE_FAILED": ("model", "Model failed to converge"),
    "MODEL_CHECKPOINT_CORRUPT": ("model", "Checkpoint file corrupted"),
    
    # Quota errors
    "QUOTA_RATE_LIMIT": ("quota", "Rate limit exceeded"),
    "QUOTA_TIME_EXCEEDED": ("quota", "Time limit exceeded"),
    "QUOTA_COST_EXCEEDED": ("quota", "Cost limit exceeded"),
    "QUOTA_MEMORY_EXCEEDED": ("quota", "Memory limit exceeded"),
    
    # Fatal errors
    "FATAL_INTERNAL": ("fatal", "Internal server error"),
    "FATAL_UNCLASSIFIED": ("fatal", "Unclassified error"),
    "FATAL_INVALID_ERROR_CLASS": ("fatal", "Invalid error class"),
    "FATAL_UNSUPPORTED_SSOT_VERSION": ("fatal", "Unsupported SSOT version"),
}

# HTTP status code mapping
HTTP_STATUS_MAP = {
    400: ("user", "USER_INVALID_INPUT"),
    401: ("user", "USER_UNAUTHORIZED"),
    403: ("user", "USER_UNAUTHORIZED"),
    404: ("user", "USER_NOT_FOUND"),
    408: ("infra", "INFRA_TIMEOUT"),
    422: ("user", "USER_INVALID_INPUT"),
    429: ("quota", "QUOTA_RATE_LIMIT"),
    500: ("fatal", "FATAL_INTERNAL"),
    502: ("infra", "INFRA_UPSTREAM_UNAVAILABLE"),
    503: ("infra", "INFRA_UPSTREAM_UNAVAILABLE"),
    504: ("infra", "INFRA_TIMEOUT"),
}


# =============================================================================
# ERROR VALIDATION
# =============================================================================

class InvalidErrorObjectError(Exception):
    """Raised when error object is invalid."""
    pass


def validate_error_obj(error: Any) -> None:
    """
    Validate error object against canon taxonomy.
    Raises InvalidErrorObjectError if invalid.
    """
    if error is None:
        return  # None is valid (no error)
    
    if isinstance(error, str):
        raise InvalidErrorObjectError(
            f"Error must be object, not string. Got: {error[:100]}"
        )
    
    if not isinstance(error, dict):
        raise InvalidErrorObjectError(
            f"Error must be dict, got: {type(error).__name__}"
        )
    
    error_class = error.get("class")
    if error_class is not None and error_class not in CANON_ERROR_CLASSES:
        raise InvalidErrorObjectError(
            f"Invalid error class: {error_class}. Must be one of: {sorted(CANON_ERROR_CLASSES)}"
        )


# =============================================================================
# ERROR NORMALIZATION
# =============================================================================

def normalize_error(err: Any) -> Optional[Dict[str, Any]]:
    """
    Normalize any error value to canonical error object.
    
    - None -> None
    - String -> {"class": "fatal", "code": "FATAL_UNCLASSIFIED", "message": string}
    - Dict -> ensure class/code/message, validate class
    - Exception -> classify and convert
    """
    if err is None:
        return None
    
    if isinstance(err, str):
        return {
            "class": "fatal",
            "code": "FATAL_UNCLASSIFIED",
            "message": err[:500]  # Truncate for safety
        }
    
    if isinstance(err, Exception):
        return classify_exception(err)
    
    if isinstance(err, dict):
        error_class = err.get("class")
        error_code = err.get("code")
        error_message = err.get("message", "Unknown error")
        
        # Validate class
        if error_class not in CANON_ERROR_CLASSES:
            return {
                "class": "fatal",
                "code": "FATAL_INVALID_ERROR_CLASS",
                "message": f"Invalid class '{error_class}': {error_message}"
            }
        
        return {
            "class": error_class,
            "code": error_code or "FATAL_UNCLASSIFIED",
            "message": str(error_message)[:500]
        }
    
    # Unknown type
    return {
        "class": "fatal",
        "code": "FATAL_UNCLASSIFIED",
        "message": f"Unknown error type: {type(err).__name__}"
    }


def classify_exception(ex: Exception) -> Dict[str, Any]:
    """
    Classify exception to canonical error object.
    """
    ex_type = type(ex).__name__
    ex_msg = str(ex)[:500]
    
    # Timeout errors
    if isinstance(ex, (TimeoutError,)):
        return {
            "class": "infra",
            "code": "INFRA_TIMEOUT",
            "message": f"Timeout: {ex_msg}"
        }
    
    # Connection errors
    if "ConnectionError" in ex_type or "connection" in ex_msg.lower():
        return {
            "class": "infra",
            "code": "INFRA_NETWORK_ERROR",
            "message": f"Connection error: {ex_msg}"
        }
    
    # Memory errors
    if isinstance(ex, MemoryError) or "OOM" in ex_msg or "out of memory" in ex_msg.lower():
        return {
            "class": "model",
            "code": "MODEL_OOM",
            "message": f"Out of memory: {ex_msg}"
        }
    
    # Value/Type errors often indicate user input issues
    if isinstance(ex, (ValueError, TypeError)):
        return {
            "class": "user",
            "code": "USER_INVALID_INPUT",
            "message": f"Invalid input: {ex_msg}"
        }
    
    # File not found
    if isinstance(ex, FileNotFoundError):
        return {
            "class": "user",
            "code": "USER_NOT_FOUND",
            "message": f"File not found: {ex_msg}"
        }
    
    # Permission errors
    if isinstance(ex, PermissionError):
        return {
            "class": "user",
            "code": "USER_UNAUTHORIZED",
            "message": f"Permission denied: {ex_msg}"
        }
    
    # Default: fatal internal error
    return {
        "class": "fatal",
        "code": "FATAL_INTERNAL",
        "message": f"{ex_type}: {ex_msg}"
    }


def from_http_status(status: int, body: str = "") -> Dict[str, Any]:
    """
    Create canonical error from HTTP status code.
    """
    mapping = HTTP_STATUS_MAP.get(status, ("fatal", "FATAL_INTERNAL"))
    error_class, error_code = mapping
    
    message = ERROR_CODES.get(error_code, (error_class, "Unknown error"))[1]
    if body:
        message = f"{message}: {body[:200]}"
    
    return {
        "class": error_class,
        "code": error_code,
        "message": message
    }


def create_error(error_code: str, message: Optional[str] = None) -> Dict[str, Any]:
    """
    Create canonical error from known error code.
    """
    if error_code not in ERROR_CODES:
        return {
            "class": "fatal",
            "code": "FATAL_UNCLASSIFIED",
            "message": message or f"Unknown error code: {error_code}"
        }
    
    error_class, default_msg = ERROR_CODES[error_code]
    return {
        "class": error_class,
        "code": error_code,
        "message": message or default_msg
    }
