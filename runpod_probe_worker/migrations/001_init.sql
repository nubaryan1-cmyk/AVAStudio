-- =============================================================================
-- AVA DATABASE MIGRATION 001: INITIAL SCHEMA
-- =============================================================================
-- 
-- This migration creates all required tables for AVAStudio production.
-- Execute with: psql -d $DATABASE_URL -f 001_init.sql
--
-- Tables:
--   - users: User accounts and plans
--   - jobs: Job contracts (photo/video/lora)
--   - job_events: Audit trail for state transitions
--   - feature_flags: Runtime flag overrides
--   - subscriptions: Stripe subscription data
--   - usage_meter: Daily usage tracking
--   - idempotency_keys: Idempotency key storage
-- =============================================================================

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- USERS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    plan TEXT NOT NULL DEFAULT 'FREE',
    role TEXT NOT NULL DEFAULT 'user',
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

-- =============================================================================
-- JOBS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS jobs (
    job_id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    user_id TEXT REFERENCES users(user_id),
    job_type TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'CREATED',
    ssot_version TEXT NOT NULL DEFAULT '1.1',
    correlation_id TEXT,
    idempotency_key TEXT,
    payload_json JSONB NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    claimed_by TEXT,
    retries INTEGER NOT NULL DEFAULT 0,
    error_json JSONB,
    result_json JSONB DEFAULT '{"artifacts": [], "metrics": {}, "error": null}',
    
    -- Constraints
    CONSTRAINT valid_state CHECK (state IN (
        'CREATED', 'VALIDATING', 'READY', 'IN_QUEUE', 'SCHEDULED',
        'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'
    )),
    CONSTRAINT valid_job_type CHECK (job_type IN (
        'photo.generate', 'video.generate', 'lora.train', 'lora.infer', 'train_lora'
    ))
);

-- Indexes for job queries
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_correlation_id ON jobs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_queue ON jobs(state, priority, created_at) WHERE state = 'IN_QUEUE';

-- Idempotency unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency 
    ON jobs(idempotency_key, user_id, job_type) 
    WHERE idempotency_key IS NOT NULL;

-- =============================================================================
-- JOB EVENTS TABLE (Audit Trail)
-- =============================================================================
CREATE TABLE IF NOT EXISTS job_events (
    id BIGSERIAL PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    old_state TEXT,
    new_state TEXT,
    details_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_events_job_id ON job_events(job_id);
CREATE INDEX IF NOT EXISTS idx_job_events_event_type ON job_events(event_type);
CREATE INDEX IF NOT EXISTS idx_job_events_created_at ON job_events(created_at DESC);

-- =============================================================================
-- FEATURE FLAGS TABLE (Runtime Overrides)
-- =============================================================================
CREATE TABLE IF NOT EXISTS feature_flags (
    flag_name TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    rollout_json JSONB,
    kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT
);

-- =============================================================================
-- SUBSCRIPTIONS TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id),
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    plan TEXT NOT NULL DEFAULT 'FREE',
    status TEXT NOT NULL DEFAULT 'active',
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- =============================================================================
-- USAGE METER TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS usage_meter (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id),
    job_type TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, job_type, date)
);

CREATE INDEX IF NOT EXISTS idx_usage_meter_user_date ON usage_meter(user_id, date);

-- =============================================================================
-- MIGRATION TRACKING TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Record this migration
INSERT INTO schema_migrations (version) 
VALUES ('001_init')
ON CONFLICT (version) DO NOTHING;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_feature_flags_updated_at ON feature_flags;
CREATE TRIGGER update_feature_flags_updated_at
    BEFORE UPDATE ON feature_flags
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE users IS 'User accounts with subscription plans';
COMMENT ON TABLE jobs IS 'Job contracts following canonical state model';
COMMENT ON TABLE job_events IS 'Audit trail for all job state transitions';
COMMENT ON TABLE feature_flags IS 'Runtime feature flag overrides';
COMMENT ON TABLE subscriptions IS 'Stripe subscription data';
COMMENT ON TABLE usage_meter IS 'Daily usage tracking for quotas';
