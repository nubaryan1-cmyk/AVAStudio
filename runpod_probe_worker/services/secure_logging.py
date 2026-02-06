"""
AVA SECURE LOGGING
Sanitizes logs to prevent leak of Secrets and PII.
"""
import re
import logging

# Patterns to mask
PATTERNS = [
    (r"(api_key|token|secret|password)=([^\s]+)", r"\1=***REDACTED***"),
    (r"(Bearer\s+)([a-zA-Z0-9\-\._]+)", r"\1***REDACTED***"),
    (r"(s3://[^/]+/[^/]+/)[^\s]+", r"\1***HASH***") # Hide exact file paths in logs if needed
]

class SecurityFilter(logging.Filter):
    def filter(self, record):
        msg = str(record.msg)
        for pattern, replacement in PATTERNS:
            msg = re.sub(pattern, replacement, msg)
        record.msg = msg
        return True

def get_secure_logger(name="ava"):
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)
    
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.addFilter(SecurityFilter())
        formatter = logging.Formatter('[%(levelname)s] %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
    return logger
