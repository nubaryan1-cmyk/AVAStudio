import {
  ConsecutiveBreaker,
  circuitBreaker,
  handleAll,
  type CircuitBreakerPolicy,
} from "cockatiel";

import { resilientCall, type ResilientCallOptions } from "./resilient-call.js";

/**
 * Именованная политика устойчивости = готовый набор опций для `resilientCall`
 * (timeout + retry + backoff + общий на категорию circuit breaker). TASK 8.3.
 *
 * Backoff везде экспоненциальный с decorrelated-jitter (дефолт cockatiel) —
 * т.е. джиттер включён во всех политиках, что важно против «thundering herd».
 */
export type ResiliencePolicy = ResilientCallOptions;

/**
 * Создаёт отдельный circuit breaker на КАТЕГОРИЮ вызовов: состояние общее для
 * всех вызовов этой политики (падения одного внешнего API копятся вместе).
 */
function categoryBreaker(threshold: number, halfOpenAfterMs: number): CircuitBreakerPolicy {
  return circuitBreaker(handleAll, {
    halfOpenAfter: halfOpenAfterMs,
    breaker: new ConsecutiveBreaker(threshold),
  });
}

/**
 * Внешние API (соцсети-агрегаторы, провайдеры и т.п.): 3 ретрая, экспонента с
 * джиттером, таймаут 10s, breaker (5 подряд → open на 15s).
 */
export const externalApiPolicy: ResiliencePolicy = {
  timeoutMs: 10_000,
  retry: { maxAttempts: 3, backoff: { initialDelay: 200, maxDelay: 5_000, exponent: 2 } },
  breaker: categoryBreaker(5, 15_000),
};

/**
 * Платежи: осторожно. Списания НЕ ретраим агрессивно (риск двойного платежа) —
 * 1 повтор, идемпотентность обеспечивает вызывающий (idempotency key). Таймаут
 * 15s, breaker размыкается рано (3 подряд → open на 30s).
 */
export const paymentPolicy: ResiliencePolicy = {
  timeoutMs: 15_000,
  retry: { maxAttempts: 1, backoff: { initialDelay: 500, maxDelay: 2_000, exponent: 2 } },
  breaker: categoryBreaker(3, 30_000),
};

/**
 * AI-генерация (картинки/видео/аудио): долгий таймаут (генерация медленная),
 * мало ретраев (дорого), breaker 4 подряд → open на 20s.
 */
export const aiPolicy: ResiliencePolicy = {
  timeoutMs: 120_000,
  retry: { maxAttempts: 2, backoff: { initialDelay: 1_000, maxDelay: 10_000, exponent: 2 } },
  breaker: categoryBreaker(4, 20_000),
};

/**
 * Постинг в соцсети: 3 ретрая с заметным джиттером (рандомизация против
 * детекта/лимитов), таймаут 20s, breaker 5 подряд → open на 30s.
 */
export const socialPolicy: ResiliencePolicy = {
  timeoutMs: 20_000,
  retry: { maxAttempts: 3, backoff: { initialDelay: 500, maxDelay: 8_000, exponent: 2 } },
  breaker: categoryBreaker(5, 30_000),
};

/** Реестр всех именованных политик (для перебора/диагностики). */
export const POLICIES = {
  externalApi: externalApiPolicy,
  payment: paymentPolicy,
  ai: aiPolicy,
  social: socialPolicy,
} as const;

export type PolicyName = keyof typeof POLICIES;

/**
 * Единый устойчивый вызов по именованной политике: `callWithPolicy(policy, fn)`.
 * Тонкая обёртка над `resilientCall` — единственная точка применения
 * timeout+retry+backoff+breaker.
 *
 * Согласование с BullMQ (TASK 8.3, п.3): здесь — APPLICATION-retry внутри одной
 * попытки job'а (короткие, ограниченные maxAttempts). Job-level retry BullMQ
 * (`attempts`) — это INFRASTRUCTURE-retry перезапуска всего job'а. Чтобы не
 * множить бесконтрольные повторы, политики держат maxAttempts маленьким
 * (1–3), а на разомкнутом breaker'е срабатывает fail-fast (без ретраев).
 */
export function callWithPolicy<T>(
  policy: ResiliencePolicy,
  fn: () => Promise<T>,
): Promise<T> {
  return resilientCall(fn, policy);
}
