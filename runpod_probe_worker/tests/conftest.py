"""
Pytest configuration for AVA tests.

Ensures Config is reset to STAGING before each test.
"""

import os
import pytest

@pytest.fixture(autouse=True)
def reset_config():
    """Reset Config to STAGING before each test."""
    os.environ["AVA_ENV"] = "STAGING"
    os.environ["AVA_MOCK_MODE"] = "1"
    
    # Reload config
    from services.config import Config
    Config.reload()
    
    yield
    
    # Reset after test as well
    os.environ["AVA_ENV"] = "STAGING"
    Config.reload()
