/**
 * Generic fallback chain (TASK 11.1). Пробует провайдеры по порядку, возвращает
 * результат первого успешного + кто отработал + лог попыток. Если все упали —
 * AggregateAiError со всеми ошибками. Никаких ретраев внутри (это уровень policy).
 */

export interface FallbackAttempt {
  provider: string;
  ok: boolean;
  error?: string;
  latencyMs: number;
}

export interface FallbackResult<T> {
  value: T;
  providerUsed: string;
  attempts: FallbackAttempt[];
}

export class AggregateAiError extends Error {
  readonly attempts: FallbackAttempt[];
  constructor(attempts: FallbackAttempt[]) {
    const detail = attempts.map((a) => `${a.provider}: ${a.error ?? "unknown"}`).join("; ");
    super(`Все AI-провайдеры недоступны (${attempts.length}): ${detail}`);
    this.name = "AggregateAiError";
    this.attempts = attempts;
  }
}

interface NamedProvider {
  readonly name: string;
}

/**
 * Выполняет `op` поочерёдно на каждом провайдере до первого успеха.
 * @throws {RangeError} если список провайдеров пуст.
 * @throws {AggregateAiError} если все провайдеры упали.
 */
export async function runWithFallback<P extends NamedProvider, T>(
  providers: readonly P[],
  op: (provider: P) => Promise<T>,
): Promise<FallbackResult<T>> {
  if (providers.length === 0) {
    throw new RangeError("runWithFallback: пустой список провайдеров");
  }
  const attempts: FallbackAttempt[] = [];
  for (const provider of providers) {
    const startedAt = Date.now();
    try {
      const value = await op(provider);
      attempts.push({ provider: provider.name, ok: true, latencyMs: Date.now() - startedAt });
      return { value, providerUsed: provider.name, attempts };
    } catch (err) {
      attempts.push({
        provider: provider.name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - startedAt,
      });
    }
  }
  throw new AggregateAiError(attempts);
}
