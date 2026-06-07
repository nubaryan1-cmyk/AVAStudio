/**
 * SLO / error budget (TASK 24.5). Чистые расчёты burn-rate для алертов. Документ целей —
 * docs/architecture/slo.md.
 */
export interface Slo {
  name: string;
  /** Целевая доля успешных, напр. 0.9995 (99.95%). */
  target: number;
  windowDays: number;
}

export const SLOS = {
  apiUptime: { name: "API uptime", target: 0.9995, windowDays: 30 },
  apiLatencyP95: { name: "API p95 < 500ms", target: 0.99, windowDays: 30 },
  renderP95: { name: "Render p95 < 60s", target: 0.95, windowDays: 30 },
  postingSuccess: { name: "Posting success > 95%", target: 0.95, windowDays: 30 },
} satisfies Record<string, Slo>;

/** Допустимая доля ошибок (error budget). */
export function errorBudget(slo: Slo): number {
  return 1 - slo.target;
}

/**
 * Burn rate = (фактическая доля ошибок за окно) / (бюджет ошибок). >1 — бюджет выгорает
 * быстрее, чем допустимо. Возвращает rate и решение об алерте по порогу (по умолчанию 2×).
 */
export function burnRate(
  slo: Slo,
  observed: { total: number; errors: number },
  threshold = 2,
): { rate: number; alert: boolean; budgetExhausted: boolean } {
  const budget = errorBudget(slo);
  const errorFraction = observed.total > 0 ? observed.errors / observed.total : 0;
  const rate = budget > 0 ? errorFraction / budget : errorFraction > 0 ? Infinity : 0;
  return { rate: Number.isFinite(rate) ? Math.round(rate * 100) / 100 : rate, alert: rate >= threshold, budgetExhausted: errorFraction >= budget };
}
