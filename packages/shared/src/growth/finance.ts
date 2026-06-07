/**
 * Финансовые метрики бизнеса (TASK 26.5): MRR, ARR, churn, LTV, CAC, рост MoM, маржа.
 * Чистые функции. Источник данных — платёжные провайдеры (карты+крипто, ЭТАП 19) +
 * unit-economics (25.6). LTV/CAC>3 — сигнал масштабировать маркетинг.
 */
export interface SubscriptionSnapshot {
  /** MRR по активным подпискам, USD. */
  mrrUsd: number;
  activeSubscribers: number;
}

export function arr(mrrUsd: number): number {
  return Math.round(mrrUsd * 12 * 100) / 100;
}

/** Churn rate за период = отток / база на начало. */
export function churnRate(input: { startCustomers: number; churned: number }): number {
  if (input.startCustomers === 0) return 0;
  return Math.round((input.churned / input.startCustomers) * 1000) / 10; // %
}

/** ARPU = MRR / число подписчиков. */
export function arpu(snap: SubscriptionSnapshot): number {
  return snap.activeSubscribers > 0 ? Math.round((snap.mrrUsd / snap.activeSubscribers) * 100) / 100 : 0;
}

/**
 * LTV = ARPU * валовая маржа / месячный churn (в долях). Чем ниже churn, тем выше LTV.
 */
export function ltv(input: { arpuUsd: number; grossMargin: number; monthlyChurnRate: number }): number {
  if (input.monthlyChurnRate <= 0) return Infinity;
  return Math.round((input.arpuUsd * input.grossMargin / input.monthlyChurnRate) * 100) / 100;
}

/** CAC = маркетинговые расходы / число привлечённых. */
export function cac(input: { spendUsd: number; acquired: number }): number {
  return input.acquired > 0 ? Math.round((input.spendUsd / input.acquired) * 100) / 100 : 0;
}

export interface LtvCacResult {
  ratio: number;
  /** >3 — здоровая экономика, можно масштабировать маркетинг. */
  healthy: boolean;
}

export function ltvCacRatio(ltvUsd: number, cacUsd: number): LtvCacResult {
  if (cacUsd <= 0) return { ratio: Infinity, healthy: true };
  const ratio = Math.round((ltvUsd / cacUsd) * 100) / 100;
  return { ratio, healthy: ratio >= 3 };
}

/** Рост MoM в процентах. */
export function momGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
