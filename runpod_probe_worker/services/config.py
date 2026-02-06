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
    supabase_jwt_secret: str | None = None
    supabase_jwt_audience: str | None = None
    
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
        supabase_jwt_secret = os.getenv("SUPABASE_JWT_SECRET")
        supabase_jwt_audience = os.getenv("SUPABASE_JWT_AUD")
        
        # --- STRICT ENFORCEMENT ---
        if env == Environment.PROD and not db_url:
            raise RuntimeError("CRITICAL: AVA_ENV=PROD requires DATABASE_URL set! Service refuses to start.")
            
        return cls(
            env=env,
            database_url=db_url,
            log_level=log_level,
            supabase_jwt_secret=supabase_jwt_secret,
            supabase_jwt_audience=supabase_jwt_audience,
        )

    @classmethod
    def reload(cls):
        global _config
        _config = None
        return get_config()

    metrics_enabled: bool = True  # Injected safely
_config = None
def get_config():
    global _config
    if _config is None: _config = Config.from_env()
    return _config
