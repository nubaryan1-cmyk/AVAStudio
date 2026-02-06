"""
AVA FEATURE FLAG SERVICE (DEBUGGED)
"""
import os
import json
import hashlib
from typing import Optional
from dataclasses import dataclass
from services.db import get_db

# Logic to find root from runpod_probe_worker/services/feature_flags.py
# __file__ = .../services/feature_flags.py
# dirname = .../services
# dirname = .../runpod_probe_worker
# dirname = .../AVASTUDIO_MASTER
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CANON_PATH = os.path.join(BASE_DIR, "_CANON", "REGISTRY", "FEATURE_FLAGS.v1.json")

@dataclass
class FlagContext:
    user_id: str
    plan: str = "FREE"

class FeatureFlagService:
    def __init__(self):
        self._cache = {}
        self.reload()

    def reload(self):
        print(f"[FLAGS] Loading from: {CANON_PATH}")
        try:
            if os.path.exists(CANON_PATH):
                with open(CANON_PATH, "r", encoding="utf-8-sig") as f:
                    self._cache = json.load(f).get("flags", {})
                print(f"[FLAGS] Loaded keys: {list(self._cache.keys())}")
            else:
                print(f"[FLAGS] CRITICAL: File not found!")
                self._cache = {}
        except Exception as e:
            print(f"[FLAGS] Error loading canon: {e}")
            self._cache = {}

    def _check_db_override(self, flag_key: str) -> Optional[bool]:
        try:
            db = get_db()
            with db.get_connection() as conn:
                # Check table existence to avoid crash if schema not applied
                # (Though Stage 10 script applies it)
                row = conn.execute("SELECT kill_switch, force_enable FROM runtime_flags WHERE flag_key = ?", (flag_key,)).fetchone()
                if row:
                    if row["kill_switch"]: return False
                    if row["force_enable"]: return True
        except Exception as e:
            # print(f"[FLAGS] DB Check skipped: {e}") 
            pass
        return None

    def is_enabled(self, flag_key: str, ctx: Optional[FlagContext] = None) -> bool:
        # 1. DB Override
        db_override = self._check_db_override(flag_key)
        if db_override is not None:
            return db_override

        # 2. Env Override
        env = os.getenv(f"FLAG_{flag_key.upper()}")
        if env == "1": return True
        if env == "0": return False

        # 3. Canon
        definition = self._cache.get(flag_key)
        if not definition:
            # print(f"[FLAGS] Key '{flag_key}' not found in cache.")
            return False
        
        if definition.get("kill_switch"): return False

        rollout = definition.get("rollout", {})
        r_type = rollout.get("type", "global")

        if r_type == "global": return definition.get("default", False)
        if not ctx: return definition.get("default", False)

        if r_type == "plan":
            allowed = rollout.get("allowed_plans", [])
            # print(f"[FLAGS] Plan Check: {ctx.plan} in {allowed}?")
            return ctx.plan in allowed

        return False

_flags = FeatureFlagService()
def get_flags(): return _flags
