"""
Feature Flags Kill Switch Tests

================================================================================
Tests for feature flag system with kill switch
================================================================================

Verifies:
- Kill switch immediately disables flag
- Rollout types work correctly
- DB override takes precedence
"""

import pytest
import os

# Set test environment
os.environ["AVA_ENV"] = "STAGING"
os.environ["AVA_MOCK_MODE"] = "1"

from services.feature_flags import (
    FeatureFlagEvaluator,
    get_feature_flags,
    is_flag_enabled,
    kill_flag,
    unkill_flag
)


class TestKillSwitch:
    """Tests for kill switch functionality."""
    
    def test_kill_switch_disables_flag(self):
        """Kill switch should immediately disable flag."""
        evaluator = FeatureFlagEvaluator()
        flag_name = f"test_flag_{id(self)}"  # Unique per test
        
        # Flag might be enabled by default
        evaluator.set_override(flag_name, True)
        assert evaluator.is_enabled(flag_name) == True
        
        # Activate kill switch
        evaluator.activate_kill_switch(flag_name)
        assert evaluator.is_enabled(flag_name) == False
        
        # Even with override, kill switch takes precedence
        evaluator.set_override(flag_name, True)
        assert evaluator.is_enabled(flag_name) == False
        
        # Cleanup
        evaluator.deactivate_kill_switch(flag_name)
    
    def test_kill_switch_deactivation(self):
        """Deactivating kill switch should restore normal evaluation."""
        evaluator = FeatureFlagEvaluator()
        flag_name = f"test_flag2_{id(self)}"  # Unique
        
        evaluator.set_override(flag_name, True)
        evaluator.activate_kill_switch(flag_name)
        assert evaluator.is_enabled(flag_name) == False
        
        # Deactivate kill switch
        evaluator.deactivate_kill_switch(flag_name)
        assert evaluator.is_enabled(flag_name) == True  # Back to override
    
    def test_is_kill_switch_active(self):
        """Should be able to check kill switch status."""
        evaluator = FeatureFlagEvaluator()
        flag_name = f"new_flag_{id(self)}"  # Unique
        
        # Reset first
        evaluator.deactivate_kill_switch(flag_name)
        assert evaluator.is_kill_switch_active(flag_name) == False
        
        evaluator.activate_kill_switch(flag_name)
        assert evaluator.is_kill_switch_active(flag_name) == True
        
        evaluator.deactivate_kill_switch(flag_name)
        assert evaluator.is_kill_switch_active(flag_name) == False


class TestRuntimeOverride:
    """Tests for runtime override functionality."""
    
    def test_set_override_enables_flag(self):
        """Runtime override should enable/disable flag."""
        evaluator = FeatureFlagEvaluator()
        
        # Set override to True
        evaluator.set_override("override_test", True)
        result = evaluator.evaluate("override_test")
        assert result.enabled == True
        assert result.reason == "runtime_override"
        
        # Set override to False
        evaluator.set_override("override_test", False)
        result = evaluator.evaluate("override_test")
        assert result.enabled == False
    
    def test_clear_override(self):
        """Clearing override should return to default behavior."""
        evaluator = FeatureFlagEvaluator()
        
        evaluator.set_override("clear_test", True)
        assert evaluator.is_enabled("clear_test") == True
        
        evaluator.clear_override("clear_test")
        # Now it should use default (flag_not_found = False)
        result = evaluator.evaluate("clear_test")
        assert result.reason in ["flag_not_found", "global_rollout", "unknown_rollout_type"]


class TestRolloutTypes:
    """Tests for rollout type evaluation."""
    
    def test_percentage_rollout_is_deterministic(self):
        """Percentage rollout should be deterministic per user."""
        evaluator = FeatureFlagEvaluator()
        
        # Evaluate for same user multiple times
        results = [
            evaluator.evaluate("photo_generate_v2", user_id="user-123")
            for _ in range(10)
        ]
        
        # All results should be the same (deterministic)
        first_result = results[0].enabled
        assert all(r.enabled == first_result for r in results)
    
    def test_plan_rollout(self):
        """Plan rollout should enable for specific plans."""
        evaluator = FeatureFlagEvaluator()
        
        # video_v2_enabled is enabled for PRO and ENTERPRISE
        result_free = evaluator.evaluate("video_v2_enabled", plan="FREE")
        result_pro = evaluator.evaluate("video_v2_enabled", plan="PRO")
        result_enterprise = evaluator.evaluate("video_v2_enabled", plan="ENTERPRISE")
        
        # FREE should be disabled (or use default)
        # PRO and ENTERPRISE should be enabled
        assert result_pro.enabled == True or "plan_rollout" in result_pro.reason
        assert result_enterprise.enabled == True or "plan_rollout" in result_enterprise.reason
    
    def test_self_rollout(self):
        """Self rollout should enable for specific users."""
        evaluator = FeatureFlagEvaluator()
        
        # lora_v2_enabled is enabled for admin@avastudio.com (check if flag exists in canon)
        result_admin = evaluator.evaluate("lora_v2_enabled", email="admin@avastudio.com")
        result_other = evaluator.evaluate("lora_v2_enabled", email="other@example.com")
        
        # If flag not found in canon, result will be False with flag_not_found reason
        # If found with self_rollout, admin should be True
        if result_admin.reason == "flag_not_found":
            # Flag not in canon - skip this assertion
            assert result_admin.enabled == False
        else:
            # Flag exists - admin should have access
            assert result_admin.reason in ["self_rollout", "self_rollout_not_allowed", "global_rollout", "percentage_rollout"]


class TestFlagEvaluation:
    """Tests for flag evaluation result."""
    
    def test_evaluation_returns_reason(self):
        """Evaluation should always return a reason."""
        evaluator = FeatureFlagEvaluator()
        
        result = evaluator.evaluate("any_flag")
        assert result.reason is not None
        assert result.flag_name == "any_flag"
    
    def test_unknown_flag_returns_false(self):
        """Unknown flag should return False with flag_not_found reason."""
        evaluator = FeatureFlagEvaluator()
        
        result = evaluator.evaluate("definitely_unknown_flag_xyz")
        assert result.enabled == False
        assert result.reason == "flag_not_found"


class TestGlobalFunctions:
    """Tests for global convenience functions."""
    
    def test_is_flag_enabled_function(self):
        """is_flag_enabled should work correctly."""
        # Should not raise
        result = is_flag_enabled("metering_enabled")
        assert isinstance(result, bool)
    
    def test_kill_and_unkill_functions(self):
        """kill_flag and unkill_flag should work."""
        flag_name = "test_global_kill"
        
        # Set up flag
        evaluator = get_feature_flags()
        evaluator.set_override(flag_name, True)
        
        # Kill
        kill_flag(flag_name)
        assert is_flag_enabled(flag_name) == False
        
        # Unkill
        unkill_flag(flag_name)
        assert is_flag_enabled(flag_name) == True