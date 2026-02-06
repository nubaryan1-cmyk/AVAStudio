"""
Stripe Webhook Verification Tests

================================================================================
Tests for Stripe webhook signature verification and entitlement management
================================================================================

Verifies:
- Webhook signature is verified
- Invalid signatures are rejected
- Entitlements are granted/revoked correctly
"""

import pytest
import os
import json
from unittest.mock import patch, MagicMock

# Set test environment
os.environ["AVA_ENV"] = "STAGING"
os.environ["AVA_MOCK_MODE"] = "1"

from services.billing_stripe import (
    verify_webhook,
    process_webhook,
    grant_entitlement,
    revoke_entitlement,
    handle_subscription_created,
    handle_subscription_deleted
)


class TestWebhookVerification:
    """Tests for webhook signature verification."""
    
    def test_missing_webhook_secret_returns_none(self):
        """Missing webhook secret should return None."""
        with patch('services.billing_stripe.get_config') as mock_config:
            mock_config.return_value.stripe_webhook_secret = None
            mock_config.return_value.stripe_secret_key = "sk_test"
            
            result = verify_webhook(b"payload", "sig_header")
            assert result is None
    
    def test_invalid_signature_returns_none(self):
        """Invalid signature should return None."""
        with patch('services.billing_stripe.get_config') as mock_config, \
             patch('services.billing_stripe.HAS_STRIPE', True):
            mock_config.return_value.stripe_webhook_secret = "whsec_test"
            mock_config.return_value.stripe_secret_key = "sk_test"
            
            # Invalid signature will fail verification
            result = verify_webhook(b"payload", "invalid_signature")
            assert result is None


class TestProcessWebhook:
    """Tests for webhook processing."""
    
    def test_invalid_signature_returns_error(self):
        """Invalid signature should return error response."""
        result = process_webhook(b"invalid", "invalid_sig")
        
        assert result["success"] == False
        assert "error" in result
    
    def test_unhandled_event_returns_success(self):
        """Unhandled event type should return success but handled=False."""
        with patch('services.billing_stripe.verify_webhook') as mock_verify:
            mock_verify.return_value = {
                "type": "unknown.event.type",
                "data": {"object": {}}
            }
            
            result = process_webhook(b"payload", "valid_sig")
            
            assert result["success"] == True
            assert result["handled"] == False


class TestEntitlementManagement:
    """Tests for entitlement grant/revoke."""
    
    def test_grant_entitlement_updates_plan(self):
        """grant_entitlement should update user plan."""
        with patch('services.billing_stripe.get_db') as mock_db:
            mock_instance = MagicMock()
            mock_db.return_value = mock_instance
            
            grant_entitlement(
                user_id="user-123",
                plan="PRO",
                stripe_subscription_id="sub_123",
                stripe_price_id="price_pro"
            )
            
            # Should call update_user_plan
            mock_instance.update_user_plan.assert_called_once_with("user-123", "PRO")
    
    def test_revoke_entitlement_downgrades_to_free(self):
        """revoke_entitlement should downgrade to FREE."""
        with patch('services.billing_stripe.get_db') as mock_db:
            mock_instance = MagicMock()
            mock_db.return_value = mock_instance
            
            revoke_entitlement(
                user_id="user-456",
                stripe_subscription_id="sub_456",
                reason="cancelled"
            )
            
            # Should call update_user_plan with FREE
            mock_instance.update_user_plan.assert_called_once_with("user-456", "FREE")


class TestSubscriptionHandlers:
    """Tests for subscription event handlers."""
    
    def test_subscription_created_extracts_plan(self):
        """subscription.created should extract plan from price."""
        with patch('services.billing_stripe.get_user_id_from_customer') as mock_user, \
             patch('services.billing_stripe.grant_entitlement') as mock_grant:
            mock_user.return_value = "user-789"
            
            event = {
                "data": {
                    "object": {
                        "id": "sub_test",
                        "customer": "cus_test",
                        "status": "active",
                        "items": {
                            "data": [{
                                "price": {"id": "price_pro_monthly"}
                            }]
                        },
                        "current_period_start": 1234567890,
                        "current_period_end": 1237246290
                    }
                }
            }
            
            result = handle_subscription_created(event)
            
            assert result["handled"] == True
            assert result["user_id"] == "user-789"
    
    def test_subscription_deleted_revokes_entitlement(self):
        """subscription.deleted should revoke entitlement."""
        with patch('services.billing_stripe.get_user_id_from_customer') as mock_user, \
             patch('services.billing_stripe.revoke_entitlement') as mock_revoke:
            mock_user.return_value = "user-abc"
            
            event = {
                "data": {
                    "object": {
                        "id": "sub_deleted",
                        "customer": "cus_abc"
                    }
                }
            }
            
            result = handle_subscription_deleted(event)
            
            assert result["handled"] == True
            assert result["plan"] == "FREE"
            mock_revoke.assert_called_once()
    
    def test_unknown_customer_returns_not_handled(self):
        """Unknown customer should return handled=False."""
        with patch('services.billing_stripe.get_user_id_from_customer') as mock_user:
            mock_user.return_value = None
            
            event = {
                "data": {
                    "object": {
                        "id": "sub_unknown",
                        "customer": "cus_unknown",
                        "status": "active"
                    }
                }
            }
            
            result = handle_subscription_created(event)
            
            assert result["handled"] == False
            assert "customer not found" in result["reason"]