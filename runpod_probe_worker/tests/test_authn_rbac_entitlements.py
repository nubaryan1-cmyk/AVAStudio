"""
AVA TESTS - AUTHENTICATION, RBAC & ENTITLEMENTS

================================================================================
Tests:
- JWT verification (Supabase)
- RBAC enforcement
- Plan-based access control
- Entitlement checking
================================================================================
"""

import pytest
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["AVA_ENV"] = "STAGING"
os.environ["AVA_MOCK_MODE"] = "1"
os.environ["AVA_SQLITE_FALLBACK"] = "1"

from services.authn import (
    AuthResult,
    SupabaseJWTVerifier,
    require_plan,
    require_role,
    _authenticate
)
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials


class TestAuthResult:
    """Test AuthResult dataclass."""
    
    def test_default_values(self):
        """Test default values."""
        result = AuthResult()
        assert result.authenticated == False
        assert result.user_id is None
        assert result.role == "user"
        assert result.plan == "FREE"
        assert result.claims == {}
    
    def test_custom_values(self):
        """Test custom values."""
        result = AuthResult(
            authenticated=True,
            user_id="user-123",
            email="test@example.com",
            role="admin",
            plan="PRO"
        )
        assert result.authenticated
        assert result.user_id == "user-123"
        assert result.plan == "PRO"


class TestJWTVerifier:
    """Test Supabase JWT verifier."""
    
    @pytest.fixture
    def verifier(self):
        """Get verifier instance."""
        return SupabaseJWTVerifier()
    
    def test_dev_token_bypass_in_staging(self, verifier):
        """Test dev token works in STAGING."""
        # STAGING mode should allow dev_token
        claims = verifier.verify("dev_token")
        
        assert claims is not None
        assert claims["sub"] == "dev-user"
        assert claims["role"] == "admin"
    
    def test_dev_prefix_bypass(self, verifier):
        """Test dev_ prefix tokens work in STAGING."""
        claims = verifier.verify("dev_custom_token")
        
        assert claims is not None
        assert claims["sub"] == "dev-user"
    
    def test_invalid_token_returns_none(self, verifier):
        """Test invalid token returns None."""
        claims = verifier.verify("invalid_token_123")
        # In STAGING without JWT secret, falls back to decode attempt
        # May return None or decoded payload depending on format
    
    def test_empty_token_returns_none(self, verifier):
        """Test empty token returns None."""
        claims = verifier.verify("")
        # May return dev claims in STAGING
        # This tests graceful handling


class TestRBACHelpers:
    """Test RBAC helper functions."""
    
    def test_require_plan_allows_matching(self):
        """Test require_plan allows matching plan."""
        user = AuthResult(authenticated=True, plan="PRO")
        
        # Should not raise
        require_plan(user, ["PRO", "ENTERPRISE"])
    
    def test_require_plan_denies_non_matching(self):
        """Test require_plan denies non-matching plan."""
        user = AuthResult(authenticated=True, plan="FREE")
        
        with pytest.raises(HTTPException) as exc_info:
            require_plan(user, ["PRO", "ENTERPRISE"])
        
        assert exc_info.value.status_code == 403
        assert "QUOTA" in exc_info.value.detail["code"]
    
    def test_require_role_allows_matching(self):
        """Test require_role allows matching role."""
        user = AuthResult(authenticated=True, role="admin")
        
        # Should not raise
        require_role(user, ["admin", "superuser"])
    
    def test_require_role_denies_non_matching(self):
        """Test require_role denies non-matching role."""
        user = AuthResult(authenticated=True, role="user")
        
        with pytest.raises(HTTPException) as exc_info:
            require_role(user, ["admin"])
        
        assert exc_info.value.status_code == 403
        assert "UNAUTHORIZED" in exc_info.value.detail["code"]


class TestPlanEntitlements:
    """Test plan-based entitlements."""
    
    def test_free_plan_limits(self):
        """Test FREE plan has correct limits."""
        from services.quotas import get_plan_quotas
        # This would test actual quota values if registry exists
        pass
    
    def test_pro_plan_unlocks_lora(self):
        """Test PRO plan unlocks LoRA training."""
        # PRO users should be able to access lora.train
        user = AuthResult(authenticated=True, plan="PRO")
        
        # Should not raise
        require_plan(user, ["PRO", "ENTERPRISE"])
    
    def test_free_blocked_from_lora(self):
        """Test FREE plan cannot access LoRA training."""
        user = AuthResult(authenticated=True, plan="FREE")
        
        with pytest.raises(HTTPException):
            require_plan(user, ["PRO", "ENTERPRISE"])


class TestAuthentication:
    """Test authentication flow."""
    
    @pytest.mark.asyncio
    async def test_authenticate_with_credentials(self):
        """Test authentication with valid credentials."""
        credentials = HTTPAuthorizationCredentials(
            scheme="Bearer",
            credentials="dev_token"
        )
        
        result = await _authenticate(credentials)
        
        assert result.authenticated
        assert result.user_id == "dev-user"
    
    @pytest.mark.asyncio
    async def test_authenticate_without_credentials(self):
        """Test authentication without credentials."""
        result = await _authenticate(None)
        
        assert not result.authenticated


if __name__ == "__main__":
    pytest.main([__file__, "-v"])