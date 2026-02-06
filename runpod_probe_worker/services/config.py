"""
AVA CONFIG SERVICE (STRICT + LOGGING)
Enforces DATABASE_URL requirement for PROD.
"""
import os
from enum import Enum
from dataclasses import dataclass

class Environment(Enum):
    PROD = "PROD"
    STAGING = "STAGING"

@dataclass
class Config:
    env: Environment
    database_url: str
    log_level: str = "INFO" # FIXED: Restored field
    
    @property
    def is_prod(self) -> bool:
        return self.env == Environment.PROD

    @classmethod
    def from_env(cls):
        env_str = os.getenv("AVA_ENV", "STAGING").upper()
        try:
            env = Environment[env_str]
        except KeyError:
            env = Environment.STAGING
            
        db_url = os.getenv("DATABASE_URL")
        log_level = os.getenv("LOG_LEVEL", "INFO").upper()
        
        # --- STRICT ENFORCEMENT ---
        if env == Environment.PROD and not db_url:
            raise RuntimeError("CRITICAL: AVA_ENV=PROD requires DATABASE_URL set! Service refuses to start.")
            
        return cls(env=env, database_url=db_url, log_level=log_level)

    metrics_enabled: bool = True  # Injected safely
_config = None
def get_config():
    global _config
    if _config is None: _config = Config.from_env()
    return _config
