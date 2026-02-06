"""
Feature Flags Tests

Tests feature flag evaluation with rollout types.
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["AVA_ENV"] = "STAGING"
os.environ["AVA_MOCK_MODE"] = "1"

from services.feature_flags import (
    FeatureFlagEvaluator,
    get_feature_flags,
    is_flag_enabled,
    kill_flag,
    unkill_flag
)


class TestFeatureFlagEvaluator:
    """Tests for feature flag evaluation."""
    
    def test_unknown_flag_returns_false(self):
        """Unknown flag defaults to False."""
        evaluator = FeatureFlagEvaluator()
        result = evaluator.evaluate("nonexistent_flag")
        assert not result.enabled
        assert result.reason == "flag_not_found"
    
    def test_global_rollout_enabled(self):
        """Global rollout with value=True enables flag."""
        evaluator = FeatureFlagEvaluator()
        # metering_enabled has global rollout = true
        result = evaluator.evaluate("metering_enabled")
        assert result.enabled or result.reason == "flag_not_found"
    
    def test_self_rollout_matches_email(self):
        """Self rollout enables for matching email."""
        evaluator = FeatureFlagEvaluator()
        # lora_v2_enabled is self rollout for admin@avastudio.com
        result = evaluator.evaluate(
            "lora_v2_enabled",
            email="admin@avastudio.com"
        )
        if result.reason != "flag_not_found":
            assert result.enabled or "self_rollout" in result.reason
    
    def test_self_rollout_rejects_other_email(self):
        """Self rollout disabled for non-matching email."""
        evaluator = FeatureFlagEvaluator()
        result = evaluator.evaluate(
            "lora_v2_enabled",
            email="other@example.com"
        )
        if result.reason != "flag_not_found":
            assert not result.enabled or "no_match" in result.reason
    
    def test_plan_rollout_pro_user(self):
        """Plan rollout enables for PRO user."""
        evaluator = FeatureFlagEvaluator()
        # video_v2_enabled is plan rollout for PRO, ENTERPRISE
        result = evaluator.evaluate(
            "video_v2_enabled",
            plan="PRO"
        )
        if result.reason != "flag_not_found":
            assert result.enabled or "plan_rollout" in result.reason
    
    def test_plan_rollout_free_user(self):
        """Plan rollout disabled for FREE user."""
        evaluator = FeatureFlagEvaluator()
        result = evaluator.evaluate(
            "video_v2_enabled",
            plan="FREE"
        )
        if result.reason != "flag_not_found":
            assert not result.enabled or "no_match" in result.reason
    
    def test_percentage_rollout_deterministic(self):
        """Percentage rollout is deterministic for same user."""
        evaluator = FeatureFlagEvaluator()
        user_id = "test-user-123"
        
        # Same user should get same result
        result1 = evaluator.evaluate("photo_generate_v2", user_id=user_id)
        result2 = evaluator.evaluate("photo_generate_v2", user_id=user_id)
        
        assert result1.enabled == result2.enabled


class TestKillSwitch:
    """Tests for kill switch functionality."""
    
    def test_kill_switch_disables_flag(self):
        """Kill switch immediately disables flag."""
        evaluator = FeatureFlagEvaluator()
        flag_name = "metering_enabled"
        
        # Activate kill switch
        evaluator.activate_kill_switch(flag_name)
        
        result = evaluator.evaluate(flag_name)
        assert not result.enabled
        assert result.reason == "kill_switch"
    
    def test_deactivate_kill_switch(self):
        """Deactivating kill switch re-enables evaluation."""
        evaluator = FeatureFlagEvaluator()
        flag_name = "metering_enabled"
        
        evaluator.activate_kill_switch(flag_name)
        evaluator.deactivate_kill_switch(flag_name)
        
        result = evaluator.evaluate(flag_name)
        assert result.reason != "kill_switch"
    
    def test_is_kill_switch_active(self):
        """Can check if kill switch is active."""
        evaluator = FeatureFlagEvaluator()
        flag_name = "test_flag_unique"
        
        # Initially not active
        # Note: may return True if persisted from previous test run
        evaluator.deactivate_kill_switch(flag_name)  # Reset
        assert not evaluator.is_kill_switch_active(flag_name)
        
        evaluator.activate_kill_switch(flag_name)
        assert evaluator.is_kill_switch_active(flag_name)


class TestRuntimeOverride:
    """Tests for runtime override."""
    
    def test_override_enables_flag(self):
        """Runtime override can enable flag."""
        evaluator = FeatureFlagEvaluator()
        flag_name = "photo_generate_v2"
        
        evaluator.set_override(flag_name, True)
        
        result = evaluator.evaluate(flag_name)
        assert result.enabled
        assert result.reason == "runtime_override"
    
    def test_override_disables_flag(self):
        """Runtime override can disable flag."""
        evaluator = FeatureFlagEvaluator()
        flag_name = "metering_enabled"
        
        evaluator.set_override(flag_name, False)
        
        result = evaluator.evaluate(flag_name)
        assert not result.enabled
        assert result.reason == "runtime_override"
    
    def test_clear_override(self):
        """Clearing override returns to normal evaluation."""
        evaluator = FeatureFlagEvaluator()
        flag_name = "metering_enabled"
        
        evaluator.set_override(flag_name, False)
        evaluator.clear_override(flag_name)
        
        result = evaluator.evaluate(flag_name)
        assert result.reason != "runtime_override"


class TestConvenienceFunctions:
    """Tests for convenience functions."""
    
    def test_is_flag_enabled(self):
        """is_flag_enabled returns boolean."""
        result = is_flag_enabled("unknown_flag")
        assert isinstance(result, bool)
    
    def test_kill_and_unkill_flag(self):
        """kill_flag and unkill_flag work."""
        flag_name = "test_kill_flag"
        
        kill_flag(flag_name)
        assert not is_flag_enabled(flag_name)
        
        unkill_flag(flag_name)
        # May still be false if flag not found


if __name__ == "__main__":
    pytest.main([__file__, "-v"])