import logging
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ssot_env_guard import validate_environment, REQUIRED_APP_ENVS


def test_warns_on_extra_envs_without_crash(caplog):
    env = {
        "AVA_ENV": "STAGING",
        "EXTRA_ENV": "1",
    }

    with caplog.at_level(logging.WARNING):
        violations = validate_environment(env=env)

    assert "EXTRA_ENV" in violations
    assert any("Unknown ENVs detected" in record.message for record in caplog.records)


def test_missing_required_env_raises():
    env = {
        "EXTRA_ENV": "1",
    }

    missing_required = REQUIRED_APP_ENVS - env.keys()
    assert missing_required

    with pytest.raises(RuntimeError) as exc_info:
        validate_environment(env=env)

    assert "Missing required ENVs" in str(exc_info.value)
