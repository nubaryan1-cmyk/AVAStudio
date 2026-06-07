/**
 * App-level rate limiting (TASK 23.2). Чистый fixed-window лимитер поверх порта CounterStore
 * (в проде — Upstash Redis INCR+EXPIRE; в тестах/dev — in-memory). Решение о допуске —
 * чистая логика, тестируема без сети. Возвращает заголовки 429/Retry-After.
 */

export interface RateRule {
  /** Лимит запросов за окно. */
  limit: number;
  /** Окно в секундах. */
  windowSec: number;
}

/** Профили лимитов: анонимы/авторизованные + дорогие операции. */
export const RATE_RULES = {
  anon: { limit: 100, windowSec: 60 },
  authed: { limit: 1000, windowSec: 60 },
  render: { limit: 10, windowSec: 3600 },
  aiGenerate: { limit: 60, windowSec: 3600 },
  posting: { limit: 30, windowSec: 3600 },
} as const satisfies Record<string, RateRule>;

export type RateRuleName = keyof typeof RATE_RULES;

export interface RateDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Секунды до сброса окна. */
  resetSec: number;
  /** Заголовок Retry-After (сек), если заблокировано. */
  retryAfterSec: number;
}

/** Порт счётчика. increment возвращает текущее значение за окно + TTL остатка. */
export interface CounterStore {
  /** Инкремент ключа в окне; возвращает {count, ttlSec}. */
  increment(key: string, windowSec: number): Promise<{ count: number; ttlSec: number }>;
}

/** Принимает решение по правилу: считает попадание и сравнивает с лимитом. */
export async function rateLimit(
  store: CounterStore,
  key: string,
  rule: RateRule,
): Promise<RateDecision> {
  const { count, ttlSec } = await store.increment(key, rule.windowSec);
  const remaining = Math.max(0, rule.limit - count);
  const allowed = count <= rule.limit;
  return {
    allowed,
    limit: rule.limit,
    remaining,
    resetSec: ttlSec,
    retryAfterSec: allowed ? 0 : ttlSec,
  };
}

/** Заголовки для ответа (RateLimit-* + Retry-After). */
export function rateLimitHeaders(d: RateDecision): Record<string, string> {
  const h: Record<string, string> = {
    "RateLimit-Limit": String(d.limit),
    "RateLimit-Remaining": String(d.remaining),
    "RateLimit-Reset": String(d.resetSec),
  };
  if (!d.allowed) h["Retry-After"] = String(d.retryAfterSec);
  return h;
}

/** In-memory CounterStore (dev/тесты/одиночный инстанс). Прод — Upstash Redis. */
export class InMemoryCounterStore implements CounterStore {
  private readonly windows = new Map<string, { count: number; expiresAt: number }>();
  constructor(private readonly now: () => number = () => Date.now()) {}
  increment(key: string, windowSec: number): Promise<{ count: number; ttlSec: number }> {
    const now = this.now();
    const cur = this.windows.get(key);
    if (!cur || cur.expiresAt <= now) {
      const expiresAt = now + windowSec * 1000;
      this.windows.set(key, { count: 1, expiresAt });
      return Promise.resolve({ count: 1, ttlSec: windowSec });
    }
    cur.count += 1;
    return Promise.resolve({ count: cur.count, ttlSec: Math.ceil((cur.expiresAt - now) / 1000) });
  }
}
