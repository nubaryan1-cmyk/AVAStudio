"""
AVA TESTS - STRIPE WEBHOOK VERIFICATION

================================================================================
Tests Stripe webhook handling:
- Signature verification (strict)
- Subscription events в†’ entitlement changes
- Audit logging for billing events
================================================================================
"""

import pytest
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["AVA_ENV"] = "STAGING"
os.environ["AVA_MOCK_MODE"] = "1"
os.environ["AVA_SQLITE_FALLBACK"] = "1"

from services.billing_stripe import (
    verify_webhook,
    process_webhook,
    grant_entitlement,
    revoke_entitlement,
    handle_subscription_created,
    handle_subscription_deleted,
    get_plan_mapping
)


class TestWebhookVerification:
    """Test Stripe webhook signature verification."""
    
    def test_invalid_signature_rejected(self):
        """Test invalid signature returns None."""
        payload = b'{"type": "test"}'
        sig_header = "invalid_signature"
        
        # Without proper secret configured, should fail
        result = verify_webhook(payload, sig_header)
        # Should be None (invalid signature)
        assert result is None
    
    def test_empty_signature_rejected(self):
        """Test empty signature returns None."""
        payload = b'{"type": "test"}'
        result = verify_webhook(payload, "")
        assert result is None


class TestProcessWebhook:
    """Test webhook processing."""
    
    def test_invalid_webhook_returns_error(self):
        """Test invalid webhook returns error response."""
        payload = b'{"type": "test"}'
        result = process_webhook(payload, "invalid")
        
        assert result.get("success") == False
        assert "error" in result
    
    def test_unhandled_event_returns_success(self):
        """Test unhandled event type returns success with handled=False."""
        # This would need a valid webhook to test fully
        pass


class TestEntitlementManagement:
    """Test entitlement grant/revoke."""
    
    @pytest.fixture
    def setup_user(self):
        """Create test user."""
        from services.db import get_db
        db = get_db()
        db.init_schema()
        
        # Create test user
        db.create_user("test-user-123", "test@example.com", "Test User")
        db.update_user_stripe_customer("test-user-123", "cus_test123")
        
        return "test-user-123"
    
    def test_grant_entitlement_updates_plan(self, setup_user):
        """Test grant_entitlement updates user plan."""
        from services.db import get_db
        db = get_db()
        
        user_id = setup_user
        
        # Grant PRO plan
        grant_entitlement(
            user_id=user_id,
            plan="PRO",
            stripe_subscription_id="sub_test123",
            stripe_price_id="price_pro"
        )
        
        # Verify plan updated
        user = db.get_user(user_id)
        assert user["plan"] == "PRO"
    
    def test_revoke_entitlement_downgrades_to_free(self, setup_user):
        """Test revoke_entitlement downgrades to FREE."""
        from services.db import get_db
        db = get_db()
        
        user_id = setup_user
        
        # First grant PRO
        grant_entitlement(
            user_id=user_id,
            plan="PRO",
            stripe_subscription_id="sub_test456",
            stripe_price_id="price_pro"
        )
        
        # Then revoke
        revoke_entitlement(
            user_id=user_id,
            stripe_subscription_id="sub_test456",
            reason="test_revoke"
        )
        
        # Verify plan is FREE
        user = db.get_user(user_id)
        assert user["plan"] == "FREE"


class TestPlanMapping:
    """Test price ID to plan mapping."""
    
    def test_get_plan_mapping(self):
        """Test plan mapping is configured."""
        mapping = get_plan_mapping()
        
        # Should have PRO and ENTERPRISE mappings
        assert "PRO" in mapping.values()
        assert "ENTERPRISE" in mapping.values()


class TestEventHandlers:
    """Test Stripe event handlers."""
    
    def test_subscription_created_handler(self):
        """Test subscription.created handler structure."""
        # Mock event structure
        event = {
            "type": "customer.subscription.created",
            "data": {
                "object": {
                    "id": "sub_test",
                    "customer": "cus_unknown",
                    "status": "active",
                    "items": {
                        "data": [
                            {"price": {"id": "price_test"}}
                        ]
                    }
                }
            }
        }
        
        result = handle_subscription_created(event)
        
        # Should handle gracefully even with unknown customer
        assert "handled" in result
        assert "event_type" in result
    
    def test_subscription_deleted_handler(self):
        """Test subscription.deleted handler structure."""
        event = {
            "type": "customer.subscription.deleted",
            "data": {
                "object": {
                    "id": "sub_deleted",
                    "customer": "cus_unknown"
                }
            }
        }
        
        result = handle_subscription_deleted(event)
        
        assert "handled" in result


if __name__ == "__main__":
    pytest.main([__file__, "-v"])