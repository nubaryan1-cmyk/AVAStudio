-- RLS-политики (TASK 3.4). Эмуляция auth.uid() через current_setting('app.current_user_id').
-- В Фазе 2 (Supabase) helper-функции заменяются на auth.uid()/auth роли.

-- ── Роли ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'avastudio_authenticated') THEN
    CREATE ROLE avastudio_authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'avastudio_service') THEN
    CREATE ROLE avastudio_service NOLOGIN BYPASSRLS;
  END IF;
END $$;
--> statement-breakpoint

-- ── Helper-функции ──
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_org_member(target_org uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = target_org AND m.user_id = app_current_user_id()) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_can_access_account(acc uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (SELECT 1 FROM social_accounts a WHERE a.id = acc AND app_is_org_member(a.org_id)) $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_can_access_posting_job(pj uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (SELECT 1 FROM posting_jobs j WHERE j.id = pj AND app_is_org_member(j.org_id)) $$;
--> statement-breakpoint

-- ── Включаем RLS на ВСЕХ таблицах ──
ALTER TABLE users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE organization_data_keys ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE proxies ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE phones ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE account_phone_bindings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE content_jobs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE media_variants ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE render_metrics ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE posting_schedules ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE posting_jobs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE post_results ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- ── Гранты для authenticated ──
GRANT SELECT, INSERT, UPDATE, DELETE ON users, organizations, org_members, organization_data_keys,
  subscriptions, usage_events, social_accounts, proxies, phones, account_phone_bindings,
  media_assets, content_jobs, media_variants, posting_schedules, posting_jobs, post_results,
  audit_log TO avastudio_authenticated;--> statement-breakpoint
GRANT SELECT ON render_metrics, payment_events TO avastudio_authenticated;--> statement-breakpoint

-- ── Политики ──
CREATE POLICY users_self ON users FOR ALL TO avastudio_authenticated
  USING (id = app_current_user_id()) WITH CHECK (id = app_current_user_id());--> statement-breakpoint
CREATE POLICY organizations_member ON organizations FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(id)) WITH CHECK (app_is_org_member(id));--> statement-breakpoint
CREATE POLICY org_members_member ON org_members FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY org_data_keys_member ON organization_data_keys FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY subscriptions_member ON subscriptions FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY usage_events_member ON usage_events FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY social_accounts_member ON social_accounts FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY proxies_member ON proxies FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY phones_member ON phones FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY media_assets_member ON media_assets FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY content_jobs_member ON content_jobs FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY media_variants_member ON media_variants FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY posting_schedules_member ON posting_schedules FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY posting_jobs_member ON posting_jobs FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY audit_log_member ON audit_log FOR ALL TO avastudio_authenticated
  USING (app_is_org_member(org_id)) WITH CHECK (app_is_org_member(org_id));--> statement-breakpoint
CREATE POLICY account_phone_bindings_member ON account_phone_bindings FOR ALL TO avastudio_authenticated
  USING (app_can_access_account(account_id)) WITH CHECK (app_can_access_account(account_id));--> statement-breakpoint
CREATE POLICY post_results_member ON post_results FOR ALL TO avastudio_authenticated
  USING (app_can_access_posting_job(posting_job_id)) WITH CHECK (app_can_access_posting_job(posting_job_id));
-- render_metrics и payment_events: RLS включён, политик для authenticated нет → 0 строк (только service-role).
