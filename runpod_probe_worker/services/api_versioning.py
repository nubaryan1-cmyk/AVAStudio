"""
AVA API VERSIONING SERVICE

================================================================================
CANON: _CANON/SEMANTICS/SSOT_VERSIONING.md
================================================================================

Provides:
- API version routing (/api/v1, /api/v2)
- Backward compatibility
- Version deprecation warnings
"""

from typing import Optional, Callable, Any
from functools import wraps
from fastapi import APIRouter, Request, Response


# =============================================================================
# API VERSIONS
# =============================================================================

API_V1 = "v1"
API_V2 = "v2"  # Future

CURRENT_VERSION = API_V1
SUPPORTED_VERSIONS = {API_V1}  # V2 not yet supported
DEPRECATED_VERSIONS = set()  # None deprecated yet


# =============================================================================
# VERSION ROUTER FACTORY
# =============================================================================

def create_versioned_router(version: str, **kwargs) -> APIRouter:
    """
    Create a versioned API router.
    
    Args:
        version: API version (v1, v2)
        **kwargs: Additional router kwargs
    
    Returns:
        APIRouter with version prefix
    """
    prefix = kwargs.pop("prefix", "")
    full_prefix = f"/api/{version}{prefix}"
    
    return APIRouter(prefix=full_prefix, **kwargs)


# Pre-configured routers
router_v1 = create_versioned_router(API_V1)
router_v2 = create_versioned_router(API_V2)  # For future use


# =============================================================================
# VERSION HEADER
# =============================================================================

VERSION_HEADER = "X-API-Version"
DEPRECATION_HEADER = "X-API-Deprecated"


def add_version_headers(response: Response, version: str) -> None:
    """
    Add version headers to response.
    """
    response.headers[VERSION_HEADER] = version
    
    if version in DEPRECATED_VERSIONS:
        response.headers[DEPRECATION_HEADER] = "true"
        response.headers["X-API-Deprecation-Notice"] = (
            f"API version {version} is deprecated. Please migrate to {CURRENT_VERSION}."
        )


# =============================================================================
# VERSION MIDDLEWARE
# =============================================================================

async def version_middleware(request: Request, call_next: Callable) -> Response:
    """
    Middleware to handle API versioning.
    """
    response = await call_next(request)
    
    # Detect version from path
    path = request.url.path
    version = None
    
    if path.startswith("/api/v1"):
        version = API_V1
    elif path.startswith("/api/v2"):
        version = API_V2
    
    if version:
        add_version_headers(response, version)
    
    return response


# =============================================================================
# VERSION DECORATOR
# =============================================================================

def api_version(version: str):
    """
    Decorator to mark endpoint's API version.
    
    Usage:
        @router.get("/endpoint")
        @api_version("v1")
        async def my_endpoint():
            ...
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            result = await func(*args, **kwargs)
            return result
        
        wrapper._api_version = version
        return wrapper
    return decorator


# =============================================================================
# VERSION COMPATIBILITY
# =============================================================================

def is_version_supported(version: str) -> bool:
    """Check if API version is supported."""
    return version in SUPPORTED_VERSIONS


def is_version_deprecated(version: str) -> bool:
    """Check if API version is deprecated."""
    return version in DEPRECATED_VERSIONS


def get_version_info() -> dict:
    """Get version information."""
    return {
        "current": CURRENT_VERSION,
        "supported": list(SUPPORTED_VERSIONS),
        "deprecated": list(DEPRECATED_VERSIONS)
    }
