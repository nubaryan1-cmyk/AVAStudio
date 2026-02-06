"""
AVA REGISTRY LOADER

================================================================================
Loads and caches canonical registry files from _CANON/REGISTRY/
================================================================================

Provides access to:
- JOB_TYPES: job type definitions and schemas
- PROVIDERS_MODELS: photo/video provider registry  
- FEATURE_FLAGS: feature flag definitions
- PLANS_QUOTAS: subscription plans and quotas
"""

import os
import json
from typing import Dict, Any, Optional, Set
from functools import lru_cache


# =============================================================================
# PATHS
# =============================================================================

def _get_canon_root() -> str:
    """Get _CANON directory path."""
    # Relative to this file: services/ -> runpod_probe_worker/ -> _CANON/
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    canon = os.path.join(os.path.dirname(base), "_CANON")
    if os.path.exists(canon):
        return canon
    # Fallback: try parent directory
    return os.path.join(base, "_CANON")


def _load_json(filename: str) -> Dict[str, Any]:
    """Load JSON file from _CANON/REGISTRY/."""
    path = os.path.join(_get_canon_root(), "REGISTRY", filename)
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# =============================================================================
# REGISTRY LOADERS (cached)
# =============================================================================

@lru_cache(maxsize=1)
def load_job_types() -> Dict[str, Any]:
    """Load JOB_TYPES registry."""
    data = _load_json("JOB_TYPES.v1.json")
    return data.get("job_types", {})


@lru_cache(maxsize=1)
def load_providers_models() -> Dict[str, Any]:
    """Load PROVIDERS_MODELS registry."""
    return _load_json("PROVIDERS_MODELS.v1.json")


@lru_cache(maxsize=1)
def load_feature_flags() -> Dict[str, Any]:
    """Load FEATURE_FLAGS registry."""
    data = _load_json("FEATURE_FLAGS.v1.json")
    return data.get("flags", {})


@lru_cache(maxsize=1)
def load_plans_quotas() -> Dict[str, Any]:
    """Load PLANS_QUOTAS registry."""
    return _load_json("PLANS_QUOTAS.v1.json")


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_job_type(job_type: str) -> Optional[Dict[str, Any]]:
    """Get job type definition."""
    return load_job_types().get(job_type)


def get_valid_job_types() -> Set[str]:
    """Get set of valid job type names."""
    return set(load_job_types().keys())


def get_photo_providers() -> Dict[str, Any]:
    """Get photo provider registry."""
    return load_providers_models().get("photo_providers", {})


def get_video_providers() -> Dict[str, Any]:
    """Get video provider registry."""
    return load_providers_models().get("video_providers", {})


def get_plan(plan_name: str) -> Optional[Dict[str, Any]]:
    """Get subscription plan definition."""
    plans = load_plans_quotas().get("plans", {})
    return plans.get(plan_name)


def get_plan_quotas(plan_name: str) -> Dict[str, Any]:
    """Get quotas for a plan."""
    plan = get_plan(plan_name)
    if plan:
        return plan.get("quotas", {})
    return {}


def get_rate_limits(plan_name: str) -> Dict[str, Any]:
    """Get rate limits for a plan."""
    rate_limits = load_plans_quotas().get("rate_limits", {})
    return rate_limits.get(plan_name, {})


# =============================================================================
# CACHE MANAGEMENT
# =============================================================================

def clear_cache() -> None:
    """Clear all cached registry data."""
    load_job_types.cache_clear()
    load_providers_models.cache_clear()
    load_feature_flags.cache_clear()
    load_plans_quotas.cache_clear()
