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
const events: Array<{ action: AuditAction; at: string; entity?: string }> = []; // п.2: демо-лог убран
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
