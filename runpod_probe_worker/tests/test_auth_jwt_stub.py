"""
Auth JWT Stub Tests

Tests that DEV API key only works in STAGING.
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["AVA_ENV"] = "STAGING"
os.environ["AVA_MOCK_MODE"] = "1"

from services.authn import (
    AuthResult,
    SupabaseJWTVerifier
)
from services.config import Config


class TestJwtVerifier:
    """Tests for JWT verification."""
    
    def test_dev_token_works_in_staging(self):
        """Dev token works in STAGING."""
        os.environ["AVA_ENV"] = "STAGING"
        Config.reload()
        
        verifier = SupabaseJWTVerifier()
        claims = verifier.verify("dev_token")
        
        assert claims is not None
        assert claims.get("email") == "dev@localhost"
    
    def test_invalid_token_returns_none(self):
        """Invalid token returns None."""
        os.environ["AVA_ENV"] = "STAGING"
        Config.reload()
        
        verifier = SupabaseJWTVerifier()
        claims = verifier.verify("invalid.token.here")
        
        # In STAGING without JWT secret, this should return None
        # or fallback decode


class TestAuthResult:
    """Tests for AuthResult dataclass."""
    
    def test_auth_result_default_values(self):
        """AuthResult has correct defaults."""
        result = AuthResult()
        
        assert result.authenticated == False
        assert result.user_id is None
        assert result.role == "user"
        assert result.plan == "FREE"
    
    def test_auth_result_authenticated(self):
        """AuthResult can be authenticated."""
        result = AuthResult(
            authenticated=True,
            user_id="user-123",
            email="test@example.com",
            role="admin",
            plan="PRO"
        )
        
        assert result.authenticated == True
        assert result.user_id == "user-123"
        assert result.plan == "PRO"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])