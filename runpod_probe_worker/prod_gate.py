"""
AVA PROD GATE (STRICT)
Ensures PROD is secure AND observed.
"""
import os
import sys

def check_prod_readiness():
    env = os.getenv("AVA_ENV", "STAGING")
    if env != "PROD":
        return

    print(">>> [PROD GATE] Inspecting Configuration...")
    errors = []

    # 1. DB URL
    if not os.getenv("DATABASE_URL"):
        errors.append("CRITICAL: DATABASE_URL missing in PROD.")

    # 2. Key Rotation Check
    stripe_key = os.getenv("STRIPE_SECRET_KEY", "")
    if stripe_key.startswith("sk_test_"):
        errors.append("SECURITY: Stripe TEST key detected in PROD environment!")

    # 3. Telemetry Enforcement (FIXED: Now Critical)
    if not os.getenv("SENTRY_DSN"):
        errors.append("OBSERVABILITY: SENTRY_DSN missing. Blind flight forbidden in PROD.")

    if errors:
        print("\n!!! PROD LAUNCH ABORTED !!!")
        for e in errors:
            print(f" - {e}")
        sys.exit(1)
    
    print("[GATE] PROD Configuration Validated. Launching...")
