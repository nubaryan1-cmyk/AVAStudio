import type { OrgId, UserId } from "../domain/ids.js";

/**
 * Audit log (TASK 23.4). Логирует значимые действия (вход, биллинг, аккаунты, настройки
 * безопасности, действия админов, постинг). Запись — через порт AuditSink (БД в проде,
 * in-memory в тестах). Retention: 1 год (Enterprise — 7 лет) настраивается на стороне БД.
 */

export const AUDIT_ACTIONS = [
  "auth.login",
  "auth.logout",
  "auth.signup",
  "billing.subscribe",
  "billing.cancel",
  "account.add",
  "account.delete",
  "security.2fa_enabled",
  "security.2fa_disabled",
  "settings.update",
  "member.invite",
  "member.remove",
  "post.publish",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditEntry {
  orgId: OrgId;
  userId: UserId;
  action: AuditAction;
  /** Тип сущности (account/subscription/...). */
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  at: Date;
}

export interface AuditContext {
  orgId: OrgId;
  userId: UserId;
  ip?: string;
  userAgent?: string;
  now?: () => Date;
}

/** Порт записи аудита (БД в инфраструктуре, in-memory в тестах). */
export interface AuditSink {
  write(entry: AuditEntry): Promise<void>;
}

/** Записывает действие в audit log. Не бросает — аудит не должен ронять бизнес-операцию. */
export async function audit(
  sink: AuditSink,
  action: AuditAction,
  ctx: AuditContext,
  details: { entity?: string; entityId?: string; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  const entry: AuditEntry = {
    orgId: ctx.orgId,
    userId: ctx.userId,
    action,
    at: (ctx.now ?? ((): Date => new Date()))(),
  };
  if (details.entity) entry.entity = details.entity;
  if (details.entityId) entry.entityId = details.entityId;
  if (details.metadata) entry.metadata = details.metadata;
  if (ctx.ip) entry.ip = ctx.ip;
  if (ctx.userAgent) entry.userAgent = ctx.userAgent;
  try {
    await sink.write(entry);
  } catch {
    // proceeds — аудит best-effort, ошибка записи логируется отдельно инфраструктурой.
  }
}

export interface AuditFilter {
  userId?: string | undefined;
  action?: AuditAction | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

/** In-memory sink + запрос с фильтрами (dev/тесты; UI читает через инфраструктурный слой). */
export class InMemoryAuditSink implements AuditSink {
  private readonly entries: AuditEntry[] = [];
  write(entry: AuditEntry): Promise<void> {
    this.entries.push(entry);
    return Promise.resolve();
  }
  query(orgId: OrgId, filter: AuditFilter = {}): AuditEntry[] {
    return this.entries
      .filter((e) => e.orgId === orgId)
      .filter((e) => (filter.userId ? e.userId === filter.userId : true))
      .filter((e) => (filter.action ? e.action === filter.action : true))
      .filter((e) => (filter.from ? e.at >= filter.from : true))
      .filter((e) => (filter.to ? e.at <= filter.to : true))
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  }
}
