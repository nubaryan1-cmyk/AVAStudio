"""
AVA TELEMETRY (SENTRY)
Captures crashes in PROD. Silent in STAGING.
"""
import os
import logging

logger = logging.getLogger("telemetry")

try:
    import sentry_sdk
    HAS_SENTRY = True
except ImportError:
    HAS_SENTRY = False

def init_telemetry():
    env = os.getenv("AVA_ENV", "STAGING")
    dsn = os.getenv("SENTRY_DSN")
    
    if env == "PROD":
        if HAS_SENTRY and dsn:
            sentry_sdk.init(
                dsn=dsn,
                traces_sample_rate=1.0,
                environment="production"
            )
            logger.info("[TELEMETRY] Sentry Enabled for PROD.")
        else:
            logger.warning("[TELEMETRY] PROD active but Sentry missing/disabled!")
    else:
        logger.info(f"[TELEMETRY] Disabled in {env} mode.")

def capture_exception(e):
    if HAS_SENTRY and os.getenv("AVA_ENV") == "PROD":
        sentry_sdk.capture_exception(e)
    # Always log locally too
    logger.error(f"[EXCEPTION] {e}", exc_info=True)
