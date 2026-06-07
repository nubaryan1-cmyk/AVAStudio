import {
  circuitBreaker,
  handleAll,
  ConsecutiveBreaker,
  SamplingBreaker,
  BrokenCircuitError,
  IsolatedCircuitError,
  CircuitState,
  type CircuitBreakerPolicy,
} from "cockatiel";

/** Человекочитаемое состояние брейкера. */
export type BreakerState = "closed" | "open" | "half-open" | "isolated";

/** Событие смены состояния брейкера (для логов/метрик). */
export interface BreakerStateChange {
  /** Имя брейкера (для трассировки, какой именно сервис «упал»). */
  name: string;
  /** Предыдущее состояние. */
  from: BreakerState;
  /** Новое состояние. */
  to: BreakerState;
  /** Момент перехода (epoch ms). */
  at: number;
}

/** Опции фабрики брейкера. */
export interface BreakerOptions {
  /**
   * Порог последовательных ошибок до размыкания (режим ConsecutiveBreaker).
   * По умолчанию 5. Игнорируется, если задан `sampling`.
   */
  threshold?: number;
  /** Время в мс до перехода open → half-open. По умолчанию 10000. */
  halfOpenAfter?: number;
  /**
   * Режим выборки: размыкание по доле ошибок за окно (SamplingBreaker).
   * Если задан — имеет приоритет над `threshold`.
   */
  sampling?: { threshold: number; duration: number; minimumRps?: number };
  /** Колбэк смены состояния (closed↔open↔half-open↔isolated). */
  onStateChange?: (event: BreakerStateChange) => void;
}

/** Управляемый брейкер вокруг конкретной операции. */
export interface BreakerHandle<A extends unknown[], R> {
  /** Имя брейкера. */
  readonly name: string;
  /** Выполнить обёрнутую операцию через брейкер. */
  run(...args: A): Promise<R>;
  /** Текущее состояние. */
  readonly state: BreakerState;
  /** Низкоуровневая политика cockatiel (для wrap в resilientCall). */
  readonly policy: CircuitBreakerPolicy;
  /** Принудительно разомкнуть (например, на деплой). Вернёт функцию возврата. */
  isolate(): () => void;
}

const DEFAULT_THRESHOLD = 5;
const DEFAULT_HALF_OPEN_AFTER_MS = 10_000;

/** Маппинг enum cockatiel → человекочитаемое состояние. */
function toBreakerState(state: CircuitState): BreakerState {
  switch (state) {
    case CircuitState.Closed:
      return "closed";
    case CircuitState.Open:
      return "open";
    case CircuitState.HalfOpen:
      return "half-open";
    case CircuitState.Isolated:
      return "isolated";
    default:
      return "closed";
  }
}

/**
 * Создаёт circuit breaker вокруг операции `fn`.
 *
 * Поведение (TASK 8.1): N последовательных ошибок (или доля ошибок в режиме
 * sampling) размыкают брейкер (open) — последующие вызовы падают мгновенно
 * (`BrokenCircuitError`), не нагружая упавший сервис. Через `halfOpenAfter`
 * брейкер переходит в half-open и пропускает одну пробную попытку: успех →
 * closed, ошибка → снова open. Все переходы публикуются в `onStateChange`.
 */
export function withBreaker<A extends unknown[], R>(
  name: string,
  fn: (...args: A) => Promise<R>,
  options: BreakerOptions = {},
): BreakerHandle<A, R> {
  const breakerImpl = options.sampling
    ? new SamplingBreaker(options.sampling)
    : new ConsecutiveBreaker(options.threshold ?? DEFAULT_THRESHOLD);

  const policy = circuitBreaker(handleAll, {
    halfOpenAfter: options.halfOpenAfter ?? DEFAULT_HALF_OPEN_AFTER_MS,
    breaker: breakerImpl,
  });

  let lastState: BreakerState = toBreakerState(policy.state);

  const emit = (to: BreakerState): void => {
    const from = lastState;
    lastState = to;
    options.onStateChange?.({ name, from, to, at: Date.now() });
  };

  policy.onBreak(() => emit("open"));
  policy.onHalfOpen(() => emit("half-open"));
  policy.onReset(() => emit("closed"));

  return {
    name,
    run: (...args: A) => policy.execute(() => fn(...args)),
    get state() {
      return toBreakerState(policy.state);
    },
    policy,
    isolate() {
      const handle = policy.isolate();
      emit("isolated");
      return () => {
        handle.dispose();
        emit(toBreakerState(policy.state));
      };
    },
  };
}

export { BrokenCircuitError, IsolatedCircuitError, CircuitState };

/** Истина, если ошибка вызвана разомкнутым/изолированным брейкером (fail-fast). */
export function isBrokenCircuitError(error: unknown): boolean {
  return error instanceof BrokenCircuitError || error instanceof IsolatedCircuitError;
}
