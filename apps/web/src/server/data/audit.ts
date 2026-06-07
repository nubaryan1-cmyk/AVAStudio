import { audit, InMemoryAuditSink, type AuditAction, type AuditEntry } from "@avastudio/shared/audit";
import { asOrgId, asUserId } from "@avastudio/shared/domain";

/**
 * Audit-данные (Фаза 1, in-memory; Phase-2 — таблица audit_log с RLS). Доступ к UI
 * гейтится правом audit.view (owner/admin, ЭТАП 10.4).
 */
const DEMO_ORG = asOrgId("org_demo");
const DEMO_USER = asUserId("user_demo");

const sink = new InMemoryAuditSink();
let seeded = false;

async function seed(): Promise<void> {
  if (seeded) return;
  seeded = true;
  const base = new Date("2026-06-01T09:00:00Z");
  const events: Array<{ action: AuditAction; at: string; entity?: string }> = [
    { action: "auth.login", at: "2026-06-01T09:00:00Z" },
    { action: "account.add", at: "2026-06-01T09:12:00Z", entity: "social_account" },
    { action: "billing.subscribe", at: "2026-06-01T10:00:00Z", entity: "subscription" },
    { action: "post.publish", at: "2026-06-01T11:30:00Z", entity: "posting_job" },
    { action: "security.2fa_enabled", at: "2026-06-02T08:00:00Z" },
  ];
  for (const e of events) {
    await audit(sink, e.action, { orgId: DEMO_ORG, userId: DEMO_USER, ip: "203.0.113.7", now: () => new Date(e.at) }, e.entity ? { entity: e.entity } : {});
  }
  void base;
}

export interface AuditFilterInput {
  action?: AuditAction | undefined;
  userId?: string | undefined;
}

export async function listAudit(filter: AuditFilterInput = {}): Promise<AuditEntry[]> {
  await seed();
  return sink.query(DEMO_ORG, filter);
}
