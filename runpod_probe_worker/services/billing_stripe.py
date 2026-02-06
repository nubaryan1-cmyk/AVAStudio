"""
AVA BILLING SERVICE (STRIPE)
Handles webhooks and plan updates.
"""
import os
import json
import logging
from services.db import get_db

# Mock Stripe if not installed
try:
    import stripe
except ImportError:
    stripe = None

logger = logging.getLogger("billing")

class BillingService:
    def __init__(self):
        self.api_key = os.getenv("STRIPE_SECRET_KEY")
        self.webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
        if stripe:
            stripe.api_key = self.api_key

    def process_webhook(self, payload: bytes, sig_header: str):
        """
        Verifies and processes Stripe events.
        """
        event = None
        
        # 1. Verify Signature (Real or Mock)
        if os.getenv("AVA_MOCK_MODE") == "1":
            event = json.loads(payload) # Trust payload in mock mode
        else:
            if not stripe: raise RuntimeError("Stripe lib missing")
            try:
                event = stripe.Webhook.construct_event(
                    payload, sig_header, self.webhook_secret
                )
            except Exception as e:
                raise ValueError(f"Invalid Signature: {e}")

        # 2. Handle Event
        event_type = event["type"]
        data = event["data"]["object"]
        
        if event_type in ["customer.subscription.created", "customer.subscription.updated"]:
            self._handle_subscription_update(data)
        
        return {"status": "processed", "type": event_type}

    def _handle_subscription_update(self, sub):
        """
        Updates user plan in DB based on Stripe Product ID.
        """
        customer_id = sub.get("customer")
        # In real app, we map customer_id -> user_id via DB.
        # For simplicity here, we assume metadata contains user_id
        user_id = sub.get("metadata", {}).get("user_id")
        
        # Determine Plan from Product
        # Simplified logic: check plan nickname or id mapping
        stripe_plan = sub.get("items", {}).get("data", [{}])[0].get("price", {}).get("nickname", "FREE").upper()
        
        # Normalize to Canon Plans
        new_plan = "FREE"
        if "PRO" in stripe_plan: new_plan = "PRO"
        if "ENTERPRISE" in stripe_plan: new_plan = "ENTERPRISE"

        if user_id:
            db = get_db()
            with db.get_connection() as conn:
                conn.execute("UPDATE users SET plan = ? WHERE user_id = ?", (new_plan, user_id))
                conn.commit()
            print(f"[BILLING] User {user_id} upgraded to {new_plan}")

_billing = BillingService()
def get_billing(): return _billing
