/**
 * Кэширование (TASK 25.2). Cache-aside поверх порта CacheStore (Redis в проде, in-memory
 * в тестах) + хелперы Cache-Control. Снижает p95 и нагрузку на БД. Инвалидация — явная
 * при изменении сущности.
 */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSec: number): Promise<void>;
  del(key: string): Promise<void>;
}

/** Cache-aside: вернуть из кэша или вычислить, закэшировать и вернуть. */
export async function cached<T>(
  store: CacheStore,
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await store.get(key);
  if (hit !== null) return JSON.parse(hit) as T;
  const value = await loader();
  await store.set(key, JSON.stringify(value), ttlSec);
  return value;
}

/** Инвалидация ключа (вызывается при мутации сущности). */
export function invalidate(store: CacheStore, key: string): Promise<void> {
  return store.del(key);
}

/** Cache-Control для публичного контента (с stale-while-revalidate). */
export function publicCacheControl(maxAgeSec: number, swrSec = maxAgeSec * 10): string {
  return `public, max-age=${maxAgeSec}, stale-while-revalidate=${swrSec}`;
}

/** Cache-Control для приватного/неоткэшируемого. */
export const NO_STORE = "private, no-store";

/** In-memory CacheStore (dev/тесты). */
export class InMemoryCache implements CacheStore {
  private readonly store = new Map<string, { v: string; exp: number }>();
  constructor(private readonly now: () => number = () => Date.now()) {}
  get(key: string): Promise<string | null> {
    const e = this.store.get(key);
    if (!e || e.exp <= this.now()) {
      this.store.delete(key);
      return Promise.resolve(null);
    }
    return Promise.resolve(e.v);
  }
  set(key: string, value: string, ttlSec: number): Promise<void> {
    this.store.set(key, { v: value, exp: this.now() + ttlSec * 1000 });
    return Promise.resolve();
  }
  del(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }
}
