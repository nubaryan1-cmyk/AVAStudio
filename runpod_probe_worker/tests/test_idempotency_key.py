"""
Idempotency Key Tests

================================================================================
Tests for idempotency via Idempotency-Key header
================================================================================

Verifies:
- Same idempotency key returns same job
- Different keys create different jobs
- Key is per-user and per-job-type
"""

import pytest
import os

# Set test environment
os.environ["AVA_ENV"] = "STAGING"
os.environ["AVA_MOCK_MODE"] = "1"

# Reset singletons
import sys
if 'services.config' in sys.modules:
    del sys.modules['services.config']
if 'services.job_core' in sys.modules:
    del sys.modules['services.job_core']
if 'services.db' in sys.modules:
    del sys.modules['services.db']
if 'services.observability' in sys.modules:
    del sys.modules['services.observability']


class TestIdempotencyKey:
    """Tests for idempotency key functionality."""
    
    def setup_method(self):
        """Setup before each test."""
        # Reset config singleton
        from services.config import Config
        Config.reload()
        # Use unique prefix for each test run
        import time
        self.key_prefix = f"test_{int(time.time() * 1000)}_"
    
    def test_create_job_with_idempotency_key(self):
        """Job created with idempotency key should be findable."""
        from services.job_core import get_job_core
        
        job_core = get_job_core()
        
        # Create job with idempotency key
        job1, is_new1 = job_core.create_job(
            job_type="photo.generate",
            payload={"prompt": "Test image"},
            user_id="user-123",
            idempotency_key=f"{self.key_prefix}idem-key-001"
        )
        
        assert is_new1 == True
        assert job1.idempotency_key == f"{self.key_prefix}idem-key-001"
    
    def test_duplicate_idempotency_key_returns_existing(self):
        """Same idempotency key should return existing job."""
        from services.job_core import get_job_core
        
        job_core = get_job_core()
        idem_key = f"{self.key_prefix}idem-key-002"
        
        # Create first job
        job1, is_new1 = job_core.create_job(
            job_type="photo.generate",
            payload={"prompt": "Test image"},
            user_id="user-456",
            idempotency_key=idem_key
        )
        
        assert is_new1 == True
        
        # Try to create with same key
        job2, is_new2 = job_core.create_job(
            job_type="photo.generate",
            payload={"prompt": "Different prompt"},
            user_id="user-456",
            idempotency_key=idem_key
        )
        
        assert is_new2 == False
        assert job2.job_id == job1.job_id  # Same job returned
    
    def test_different_users_same_key_creates_separate_jobs(self):
        """Different users with same key should create separate jobs."""
        from services.job_core import get_job_core
        
        job_core = get_job_core()
        idem_key = f"{self.key_prefix}shared-key-001"
        
        # User A creates job
        job_a, is_new_a = job_core.create_job(
            job_type="photo.generate",
            payload={"prompt": "Test"},
            user_id="user-A",
            idempotency_key=idem_key
        )
        
        # User B creates job with same key
        job_b, is_new_b = job_core.create_job(
            job_type="photo.generate",
            payload={"prompt": "Test"},
            user_id="user-B",
            idempotency_key=idem_key
        )
        
        # Both should be new (different users)
        assert is_new_a == True
        assert is_new_b == True
        assert job_a.job_id != job_b.job_id
    
    def test_different_job_types_same_key_creates_separate_jobs(self):
        """Same key but different job types should create separate jobs."""
        from services.job_core import get_job_core
        
        job_core = get_job_core()
        idem_key = f"{self.key_prefix}multi-type-key-001"
        
        # Photo job
        job_photo, is_new_photo = job_core.create_job(
            job_type="photo.generate",
            payload={"prompt": "Test"},
            user_id="user-789",
            idempotency_key=idem_key
        )
        
        # Video job with same key
        job_video, is_new_video = job_core.create_job(
            job_type="video.generate",
            payload={"prompt": "Test"},
            user_id="user-789",
            idempotency_key=idem_key
        )
        
        # Both should be new (different job types)
        assert is_new_photo == True
        assert is_new_video == True
        assert job_photo.job_id != job_video.job_id
    
    def test_no_idempotency_key_always_creates_new(self):
        """No idempotency key should always create new job."""
        from services.job_core import get_job_core
        
        job_core = get_job_core()
        
        # Create without key
        job1, is_new1 = job_core.create_job(
            job_type="photo.generate",
            payload={"prompt": "Test"},
            user_id="user-no-key"
        )
        
        # Create again without key
        job2, is_new2 = job_core.create_job(
            job_type="photo.generate",
            payload={"prompt": "Test"},
            user_id="user-no-key"
        )
        
        assert is_new1 == True
        assert is_new2 == True
        assert job1.job_id != job2.job_id