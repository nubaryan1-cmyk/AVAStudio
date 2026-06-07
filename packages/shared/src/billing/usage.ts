import type { LimitMetric } from "./plans.js";
import type { OrgId } from "../domain/ids.js";

/**
 * Учёт использования (usage metering, TASK 9.5). Provider-agnostic: пишет события
 * использования и агрегирует их по дням для проверки лимитов (entitlements, 9.2) и биллинга.
 * Источник хранения абстрагирован портом UsageRepository — слой shared не знает про реальную БД.
 */

/** Метрики использования зеркалят лимит-метрики тарифов (9.2): единый словарь. */
export const USAGE_METRICS = [
  "accounts",
  "renders",
  "videoMinutes",
  "seats",
  "aiGenerations",
  "posts",
] as const satisfies readonly LimitMetric[];

export type UsageMetric = LimitMetric;

/** Единичное событие использования (append-only журнал). */
export interface UsageEvent {
  orgId: OrgId;
  metric: UsageMetric;
  amount: number;
  occurredAt: Date;
}

/** Агрегат за сутки по (org, metric, day). */
export interface UsageDaily {
  orgId: OrgId;
  metric: UsageMetric;
  /** День в формате YYYY-MM-DD (UTC). */
  day: string;
  total: number;
}

/**
 * Порт хранилища usage. Реализуется реальной БД в инфраструктуре (ЭТАП позже),
 * в тестах — InMemoryUsageRepository. Слой shared зависит только от интерфейса.
 */
export interface UsageRepository {
  /** Дописать событие в usage_events. */
  appendEvent(event: UsageEvent): Promise<void>;
  /** Все события за период [from, to) (для агрегации/проверок). */
  listEvents(orgId: OrgId, from: Date, to: Date): Promise<UsageEvent[]>;
  /** Записать/обновить дневной агрегат (idempotent upsert по org+metric+day). */
  upsertDaily(row: UsageDaily): Promise<void>;
  /** Прочитать дневной агрегат (если есть). */
  getDaily(orgId: OrgId, metric: UsageMetric, day: string): Promise<UsageDaily | undefined>;
}

/** День (UTC, YYYY-MM-DD) из даты. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Записать использование. amount по умолчанию 1 (на одно действие).
 * Идемпотентность не требуется на уровне события (append-only журнал);
 * дедуп платёжных событий — отдельно в webhook-handler.
 */
export async function recordUsage(
  repo: UsageRepository,
  orgId: OrgId,
  metric: UsageMetric,
  amount = 1,
  occurredAt: Date = new Date(),
): Promise<UsageEvent> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`recordUsage: amount должен быть положительным числом, получено ${amount}`);
  }
  const event: UsageEvent = { orgId, metric, amount, occurredAt };
  await repo.appendEvent(event);
  return event;
}

/**
 * Агрегировать использование за сутки `day` (YYYY-MM-DD, UTC) → usage_daily.
 * Вызывается ежедневным cron (ЭТАП 5). Идемпотентно: повторный прогон даёт тот же агрегат.
 */
export async function aggregateDaily(
  repo: UsageRepository,
  orgId: OrgId,
  day: string,
): Promise<UsageDaily[]> {
  const from = new Date(`${day}T00:00:00.000Z`);
  const to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
  const events = await repo.listEvents(orgId, from, to);

  const totals = new Map<UsageMetric, number>();
  for (const ev of events) {
    totals.set(ev.metric, (totals.get(ev.metric) ?? 0) + ev.amount);
  }

  const rows: UsageDaily[] = [];
  for (const [metric, total] of totals) {
    const row: UsageDaily = { orgId, metric, day, total };
    await repo.upsertDaily(row);
    rows.push(row);
  }
  return rows;
}

/**
 * Текущее использование организации за период (для построения OrgEntitlementContext.usage).
 * Суммирует события по метрикам.
 */
export async function getUsageForPeriod(
  repo: UsageRepository,
  orgId: OrgId,
  from: Date,
  to: Date,
): Promise<Partial<Record<UsageMetric, number>>> {
  const events = await repo.listEvents(orgId, from, to);
  const usage: Partial<Record<UsageMetric, number>> = {};
  for (const ev of events) {
    usage[ev.metric] = (usage[ev.metric] ?? 0) + ev.amount;
  }
  return usage;
}

/** Простое in-memory хранилище usage (тесты/локально). НЕ для прода. */
export class InMemoryUsageRepository implements UsageRepository {
  private readonly events: UsageEvent[] = [];
  private readonly daily = new Map<string, UsageDaily>();

  private dailyKey(orgId: OrgId, metric: UsageMetric, day: string): string {
    return `${orgId}::${metric}::${day}`;
  }

  appendEvent(event: UsageEvent): Promise<void> {
    this.events.push({ ...event });
    return Promise.resolve();
  }

  listEvents(orgId: OrgId, from: Date, to: Date): Promise<UsageEvent[]> {
    const out = this.events.filter(
      (e) => e.orgId === orgId && e.occurredAt >= from && e.occurredAt < to,
    );
    return Promise.resolve(out);
  }

  upsertDaily(row: UsageDaily): Promise<void> {
    this.daily.set(this.dailyKey(row.orgId, row.metric, row.day), { ...row });
    return Promise.resolve();
  }

  getDaily(orgId: OrgId, metric: UsageMetric, day: string): Promise<UsageDaily | undefined> {
    return Promise.resolve(this.daily.get(this.dailyKey(orgId, metric, day)));
  }
}
