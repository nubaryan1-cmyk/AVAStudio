/**
 * Account risk scoring + proxy reputation (TASK 25.5). Чистые функции на агрегатах из
 * ClickHouse (25.4). risk_score снижает активность рискованных аккаунтов; плохие прокси
 * выводятся из ротации. Интегрируется в scheduler (12.7) и anti-ban (12.6) как сигнал —
 * без изменения их ядра.
 */
export interface AccountSignals {
  /** Чекпойнтов за 30 дней. */
  checkpoints30d: number;
  /** Средний reach последних постов (доля от обычного, 0..1). */
  avgReachRatio: number;
  /** Возраст аккаунта в днях. */
  ageDays: number;
  /** Прошёл ли прогрев. */
  warmedUp: boolean;
}

/** risk_score 0..100 (выше — рискованнее). */
export function accountRiskScore(s: AccountSignals): number {
  let score = 0;
  score += Math.min(40, s.checkpoints30d * 13); // чекпойнты — сильнейший сигнал
  score += Math.round((1 - clamp01(s.avgReachRatio)) * 30); // падение охвата → shadowban-риск
  if (s.ageDays < 14) score += 20; // молодые аккаунты рискованнее
  else if (s.ageDays < 60) score += 10;
  if (!s.warmedUp) score += 15;
  return Math.max(0, Math.min(100, score));
}

export type RiskLevel = "low" | "medium" | "high";

export function riskLevel(score: number): RiskLevel {
  if (score >= 66) return "high";
  if (score >= 33) return "medium";
  return "low";
}

/** Множитель активности: high-risk аккаунты постят реже (анти-бан сигнал). */
export function activityMultiplier(score: number): number {
  switch (riskLevel(score)) {
    case "high":
      return 0.3;
    case "medium":
      return 0.6;
    case "low":
      return 1;
  }
}

// ───────────────────────── Proxy reputation ─────────────────────────

export interface ProxyStats {
  proxyId: string;
  success: number;
  fail: number;
}

/** Репутация прокси 0..1 (Wilson-подобный консервативный score: penalize малую выборку). */
export function proxyReputation(stats: ProxyStats): number {
  const total = stats.success + stats.fail;
  if (total === 0) return 0.5; // неизвестно — нейтрально
  const rate = stats.success / total;
  // штраф за малую выборку: тянем к 0.5 при малом total.
  const confidence = Math.min(1, total / 20);
  return Math.round((0.5 + (rate - 0.5) * confidence) * 1000) / 1000;
}

/** Исключить прокси из ротации, если репутация ниже порога и выборка достаточна. */
export function shouldRetireProxy(stats: ProxyStats, threshold = 0.6): boolean {
  const total = stats.success + stats.fail;
  return total >= 10 && proxyReputation(stats) < threshold;
}

/** Сортирует прокси по репутации (лучшие первыми) для предпочтения надёжных. */
export function rankProxies(all: readonly ProxyStats[]): ProxyStats[] {
  return [...all].sort((a, b) => proxyReputation(b) - proxyReputation(a));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
