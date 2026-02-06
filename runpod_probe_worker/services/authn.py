"""
AVA AUTHENTICATION SERVICE (SECURED)
PROD Rule: No dev tokens allowed.
"""
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from services.config import get_config

@dataclass
class AuthResult:
    authenticated: bool = False
    user_id: Optional[str] = None
    role: str = "user"
    plan: str = "FREE"
    email: Optional[str] = None
    claims: Dict[str, Any] = field(default_factory=dict)

class SupabaseJWTVerifier:
    def __init__(self):
        self.config = get_config()

    def verify(self, token: str) -> Optional[Dict[str, Any]]:
        # --- PROD BOOT GATE ---
        if self.config.is_prod:
            # SEC-003: STRICT PROD POLICY
            if token.startswith("dev_") or token == "dev_token":
                print(f"[SECURITY] REJECTED dev_token in PROD environment.")
                return None
                
            if not self.config.supabase_jwt_secret:
                print(f"[SECURITY] PROD requires SUPABASE_JWT_SECRET.")
                return None
        # ----------------------

        # STAGING Bypass
        if not self.config.is_prod and (token == "dev_token" or token.startswith("dev_")):
            return {
                "sub": "dev-user",
                "role": "admin",
                "email": "dev@local"
            }

        if not self.config.supabase_jwt_secret:
            return None

        try:
            decode_kwargs = {
                "key": self.config.supabase_jwt_secret,
                "algorithms": ["HS256"],
                "options": {"verify_aud": False},
            }
            if self.config.supabase_jwt_audience:
                decode_kwargs["audience"] = self.config.supabase_jwt_audience
                decode_kwargs["options"] = {"verify_aud": True}
            return jwt.decode(token, **decode_kwargs)
        except jwt.PyJWTError:
            return None


_http_bearer = HTTPBearer(auto_error=False)

async def _authenticate(credentials: HTTPAuthorizationCredentials | None) -> AuthResult:
    if not credentials or credentials.scheme.lower() != "bearer":
        return AuthResult()

    verifier = SupabaseJWTVerifier()
    claims = verifier.verify(credentials.credentials)
    if not claims:
        return AuthResult()

    return AuthResult(
        authenticated=True,
        user_id=claims.get("sub"),
        role=claims.get("role", "user"),
        plan=claims.get("plan", "FREE"),
        email=claims.get("email"),
        claims=claims,
    )

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_http_bearer),
) -> AuthResult:
    result = await _authenticate(credentials)
    if not result.authenticated or not result.user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid or missing token"},
        )
    request.state.user_id = result.user_id
    request.state.role = result.role
    return result


def require_plan(user: AuthResult, allowed_plans: list[str]) -> None:
    if user.plan not in allowed_plans:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "QUOTA_EXCEEDED", "message": "Plan does not allow action"},
        )


def require_role(user: AuthResult, allowed_roles: list[str]) -> None:
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "UNAUTHORIZED", "message": "Role does not allow action"},
        )
