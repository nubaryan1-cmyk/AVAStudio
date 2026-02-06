"""
AVA QUOTA SERVICE (ROBUST + BOM SAFE)
Enforces limits based on User Plan (Canon).
"""
import os
import json
import time
from services.db import get_db

# Canon Path
CANON_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "_CANON", "REGISTRY", "PLANS_QUOTAS.v1.json"
)

# Hardcoded Safe Defaults
DEFAULT_RULES = {
    "daily_jobs": 0,
    "concurrent_jobs": 0,
    "features": []
}

class QuotaService:
    def __init__(self):
        self._plans = {}
        self.reload()

    def reload(self):
        try:
            if os.path.exists(CANON_PATH):
                # FIX: use 'utf-8-sig' to handle Windows BOM automatically
                with open(CANON_PATH, "r", encoding="utf-8-sig") as f:
                    self._plans = json.load(f).get("plans", {})
                print(f"[QUOTA] Loaded plans: {list(self._plans.keys())}")
            else:
                print(f"[QUOTA] WARN: Canon file not found at {CANON_PATH}")
                self._plans = {}
        except Exception as e:
            print(f"[QUOTA] ERROR loading canon: {e}")
            self._plans = {}

    def check_quota(self, user_id: str, job_type: str):
        db = get_db()
        
        # 1. Get User Plan
        try:
            with db.get_connection() as conn:
                cur = conn.execute("SELECT plan FROM users WHERE user_id = ?", (user_id,))
                row = cur.fetchone()
                plan_name = row["plan"] if row else "FREE"
        except Exception as e:
            print(f"[QUOTA] DB Error: {e}")
            plan_name = "FREE"

        # 2. Get Rules
        rules = self._plans.get(plan_name)
        if not rules:
            rules = self._plans.get("FREE", DEFAULT_RULES)
        
        # 3. Check Feature Access
        allowed_features = rules.get("features", [])
        # Support wildcard "*"
        if "*" not in allowed_features and job_type not in allowed_features:
            raise PermissionError(f"Plan {plan_name} does not support {job_type}")

        # 4. Check Daily Limit
        limit = rules.get("daily_jobs", 0)
        
        since = time.time() - 86400
        with db.get_connection() as conn:
            cur = conn.execute("""
                SELECT COUNT(*) as cnt FROM jobs 
                WHERE user_id = ? AND created_at > ?
            """, (user_id, since))
            res = cur.fetchone()
            usage = res["cnt"] if res else 0

        if usage >= limit:
            raise ValueError(f"QUOTA_EXCEEDED: Plan {plan_name} limit is {limit}/day. Used: {usage}")

        return True

_quota = QuotaService()
def get_quota(): return _quota
