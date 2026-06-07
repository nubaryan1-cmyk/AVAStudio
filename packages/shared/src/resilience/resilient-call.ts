import {
  retry,
  handleAll,
  handleWhen,
  wrap,
  timeout,
  TimeoutStrategy,
  ExponentialBackoff,
  type IPolicy,
  type CircuitBreakerPolicy,
} from "cockatiel";

import { isBrokenCircuitError, type BreakerHandle } from "./breaker.js";

/** Параметры экспоненциального backoff с опциональным джиттером. */
export interface BackoffOptions {
  /** Базовая задержка первой повторной попытки, мс. По умолчанию 100. */
  initialDelay?: number;
  /** Потолок задержки, мс. По умолчанию 10000. */
  maxDelay?: number;
  /** Основание экспоненты. По умолчанию 2. */
  exponent?: number;
}

/** Опции повторов. */
export interface RetryOptions {
  /** Максимум попыток ретрая (не считая первой). По умолчанию 3. */
  maxAttempts?: number;
  /** Параметры backoff. */
  backoff?: BackoffOptions;
}

/** Брейкер либо как handle (withBreaker), либо как сырая политика cockatiel. */
export type BreakerLike = BreakerHandle<unknown[], unknown> | CircuitBreakerPolicy;

/** Опции единого устойчивого вызова: timeout + retry + breaker. */
export interface ResilientCallOptions {
  /** Таймаут одной попытки, мс. Если не задан — без таймаута. */
  timeoutMs?: number;
  /** Опции ретрая. `false` — отключить ретраи целиком. */
  retry?: RetryOptions | false;
  /** Брейкер, через который проходит вызов. */
  breaker?: BreakerLike;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_INITIAL_DELAY_MS = 100;
const DEFAULT_MAX_DELAY_MS = 10_000;
const DEFAULT_EXPONENT = 2;

/** Достаёт политику cockatiel из handle или принимает её напрямую. */
function toPolicy(breaker: BreakerLike): CircuitBreakerPolicy {
  return "policy" in breaker ? breaker.policy : breaker;
}

/**
 * Единый устойчивый вызов внешней операции (TASK 8.1).
 *
 * Композиция (снаружи внутрь): retry → breaker → timeout. То есть таймаут
 * ограничивает каждую попытку, брейкер считает падения, retry повторяет
 * транзиентные ошибки с экспоненциальным backoff. На разомкнутом брейкере
 * вызов падает мгновенно — retry НЕ повторяет `BrokenCircuitError`.
 */
export async function resilientCall<T>(
  fn: () => Promise<T>,
  options: ResilientCallOptions = {},
): Promise<T> {
  const policies: IPolicy[] = [];

  if (options.retry !== false) {
    const r = options.retry ?? {};
    const b = r.backoff ?? {};
    // Не повторяем fail-fast разомкнутого брейкера — иначе ретраи бессмысленны.
    const handler = handleWhen((error) => !isBrokenCircuitError(error));
    policies.push(
      retry(handler, {
        maxAttempts: r.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        backoff: new ExponentialBackoff({
          initialDelay: b.initialDelay ?? DEFAULT_INITIAL_DELAY_MS,
          maxDelay: b.maxDelay ?? DEFAULT_MAX_DELAY_MS,
          exponent: b.exponent ?? DEFAULT_EXPONENT,
        }),
      }),
    );
  }

  if (options.breaker) {
    policies.push(toPolicy(options.breaker));
  }

  if (options.timeoutMs !== undefined) {
    policies.push(timeout(options.timeoutMs, TimeoutStrategy.Aggressive));
  }

  if (policies.length === 0) {
    return fn();
  }

  const composed = policies.length === 1 ? policies[0]! : wrap(...policies);
  return composed.execute(() => fn()) as Promise<T>;
}

export { handleAll, handleWhen };
