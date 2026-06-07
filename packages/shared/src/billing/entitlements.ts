import { PaymentRequiredError } from "../errors/index.js";

import { getPlan, type LimitMetric, type PlanId } from "./plans.js";

/**
 * Движок лимитов (entitlements, TASK 9.2). Provider-agnostic: проверяет действие против
 * лимитов плана и текущего использования. Источник usage — TASK 9.5 (передаётся снаружи).
 */

/** Контекст организации для проверки лимитов. */
export interface OrgEntitlementContext {
  planId: PlanId;
  /** Текущее использование по метрикам за период (отсутствующая метрика = 0). */
  usage: Partial<Record<LimitMetric, number>>;
}

export interface EntitlementCheck {
  metric: LimitMetric;
  /** null = безлимит. */
  limit: number | null;
  used: number;
  requested: number;
  allowed: boolean;
  /** Остаток (null при безлимите). */
  remaining: number | null;
}

/** Высокоуровневые действия → метрика лимита. */
export const ACTION_METRIC = {
  add_account: "accounts",
  render: "renders",
  ai_generate: "aiGenerations",
  post: "posts",
} as const satisfies Record<string, LimitMetric>;

export type EntitlementAction = keyof typeof ACTION_METRIC;

/** Проверяет, можно ли увеличить метрику на `requested` в рамках лимита плана. */
export function checkLimit(
  ctx: OrgEntitlementContext,
  metric: LimitMetric,
  requested = 1,
): EntitlementCheck {
  const limit = getPlan(ctx.planId).limits[metric];
  const used = ctx.usage[metric] ?? 0;
  const allowed = limit === null || used + requested <= limit;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  return { metric, limit, used, requested, allowed, remaining };
}

/** То же, но по высокоуровневому действию. */
export function checkAction(
  ctx: OrgEntitlementContext,
  action: EntitlementAction,
  requested = 1,
): EntitlementCheck {
  return checkLimit(ctx, ACTION_METRIC[action], requested);
}

/**
 * Бросает PaymentRequiredError при превышении лимита (для использования в обработчиках).
 * Возвращает результат проверки, если действие разрешено.
 */
export function assertWithinLimit(
  ctx: OrgEntitlementContext,
  metric: LimitMetric,
  requested = 1,
): EntitlementCheck {
  const result = checkLimit(ctx, metric, requested);
  if (!result.allowed) {
    throw new PaymentRequiredError({
      userMessage: "Превышен лимит тарифа. Обновите план, чтобы продолжить.",
      internalMessage: `limit exceeded: metric=${metric} used=${result.used} limit=${String(
        result.limit,
      )} requested=${requested} plan=${ctx.planId}`,
      details: { metric, limit: result.limit, used: result.used },
    });
  }
  return result;
}

export interface UsageVsLimit {
  metric: LimitMetric;
  limit: number | null;
  used: number;
  remaining: number | null;
  /** Доля использования [0..1]; 0 при безлимите. */
  ratio: number;
}

/** Использование против лимита для отображения (прогресс-бары и т.п.). */
export function getUsageVsLimit(
  ctx: OrgEntitlementContext,
  metric: LimitMetric,
): UsageVsLimit {
  const limit = getPlan(ctx.planId).limits[metric];
  const used = ctx.usage[metric] ?? 0;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const ratio = limit === null || limit === 0 ? 0 : Math.min(1, used / limit);
  return { metric, limit, used, remaining, ratio };
}
