/**
 * Контроль AI-расходов (TASK 21.2 cost-аномалии + 21.3 дневной cap/rate-limit).
 * Чистые функции — тестируемы; постановку алертов/backpressure делает инфраструктура.
 * Стоимость — десятичные строки (как Money 9.1).
 */

/** Per-provider лимиты под квоты провайдеров (RPS + конкурентность). */
export interface ProviderRateConfig {
  requestsPerSecond: number;
  maxConcurrency: number;
}

/** Дефолтные лимиты под реальные провайдеры (уточняются по их тарифам). */
export const PROVIDER_RATE_LIMITS: Record<string, ProviderRateConfig> = {
  "openai-image": { requestsPerSecond: 5, maxConcurrency: 5 },
  "replicate-flux": { requestsPerSecond: 10, maxConcurrency: 10 },
  "runway-video": { requestsPerSecond: 2, maxConcurrency: 3 },
  "luma-video": { requestsPerSecond: 2, maxConcurrency: 3 },
  "elevenlabs-tts": { requestsPerSecond: 5, maxConcurrency: 5 },
  "suno-music": { requestsPerSecond: 1, maxConcurrency: 2 },
};

export function rateConfigFor(provider: string): ProviderRateConfig {
  return PROVIDER_RATE_LIMITS[provider] ?? { requestsPerSecond: 2, maxConcurrency: 2 };
}

// ───────────────────────── Дневной cap расходов (21.3) ─────────────────────────

export interface SpendCapDecision {
  allowed: boolean;
  remaining: string;
  reason: "ok" | "org_cap" | "system_cap";
}

function toNum(s: string): number {
  return Number(s) || 0;
}

/**
 * Проверяет, можно ли потратить `cost` при текущем дневном расходе. Зажат и org-лимитом
 * (из тарифа), и system-лимитом (защита платформы). Возвращает решение + остаток.
 */
export function checkSpendCap(input: {
  spentTodayUsd: string;
  costUsd: string;
  orgDailyCapUsd: string;
  systemDailyCapUsd: string;
}): SpendCapDecision {
  const spent = toNum(input.spentTodayUsd);
  const cost = toNum(input.costUsd);
  const orgCap = toNum(input.orgDailyCapUsd);
  const sysCap = toNum(input.systemDailyCapUsd);
  const after = spent + cost;
  if (after > sysCap) {
    return { allowed: false, remaining: Math.max(0, sysCap - spent).toFixed(6), reason: "system_cap" };
  }
  if (after > orgCap) {
    return { allowed: false, remaining: Math.max(0, orgCap - spent).toFixed(6), reason: "org_cap" };
  }
  return { allowed: true, remaining: (orgCap - after).toFixed(6), reason: "ok" };
}

// ───────────────────────── Детектор аномалий расходов (21.2) ─────────────────────────

export interface CostAnomaly {
  anomalous: boolean;
  ratio: number;
}

/**
 * Сравнивает сегодняшний расход со средним за базовый период. Аномалия, если расход
 * превышает baseline в `factor` раз (по умолчанию 3×) и заметен в абсолюте (> minUsd).
 */
export function detectCostAnomaly(
  todayUsd: string,
  baselineAvgUsd: string,
  factor = 3,
  minUsd = 5,
): CostAnomaly {
  const today = toNum(todayUsd);
  const base = toNum(baselineAvgUsd);
  if (today < minUsd) return { anomalous: false, ratio: 0 };
  const ratio = base > 0 ? today / base : Infinity;
  return { anomalous: ratio >= factor, ratio: Number.isFinite(ratio) ? Math.round(ratio * 100) / 100 : ratio };
}
