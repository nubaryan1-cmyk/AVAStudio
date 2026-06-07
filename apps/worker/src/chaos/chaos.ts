import { ExternalServiceError } from "@avastudio/shared";

/** Типы инъектируемых сбоев chaos-харнеса. */
export type ChaosFaultKind = "error" | "slow" | "kill";

/** Ошибка-маркер «воркер убит во время задачи» (имитация аварийного завершения). */
export class WorkerKilledError extends Error {
  override readonly name = "WorkerKilledError";
  constructor(message = "worker убит во время обработки задачи (chaos)") {
    super(message);
  }
}

/** Конфиг chaos-контроллера. Все сбои — управляемые и детерминируемые. */
export interface ChaosConfig {
  /** Главный выключатель. Chaos активен ТОЛЬКО при enabled=true (dev/test). */
  enabled: boolean;
  /** Искусственная задержка перед выполнением, мс (имитация «медленного» внешнего мока). */
  slowMs?: number;
  /** Бросить ошибку ровно N первых вызовов (имитация транзиентного сбоя → ретрай BullMQ). */
  failFirst?: number;
  /** Вероятность ошибки на каждый вызов [0..1]. */
  errorRate?: number;
  /** Один раз сымитировать «убийство» воркера (WorkerKilledError). */
  killOnce?: boolean;
  /** Источник случайности (для детерминированных тестов). По умолчанию Math.random. */
  rng?: () => number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chaos-контроллер (TASK 8.4) — инъекция контролируемых сбоев вокруг операции.
 * ТОЛЬКО для dev/test: перед использованием в проде вызывает `assertDevOnly`.
 * Не содержит prod-логики и не включается без явного `enabled: true`.
 */
export class ChaosController {
  private failsLeft: number;
  private killArmed: boolean;
  private readonly rng: () => number;

  constructor(private readonly config: ChaosConfig) {
    this.failsLeft = config.failFirst ?? 0;
    this.killArmed = config.killOnce ?? false;
    this.rng = config.rng ?? Math.random;
  }

  /** Запрещает запуск chaos в production (вызывать в точке включения). */
  static assertDevOnly(nodeEnv: string): void {
    if (nodeEnv === "production") {
      throw new Error("chaos-харнес запрещён в production (только dev/test)");
    }
  }

  /** Сброс внутреннего состояния (для повторных сценариев в тестах). */
  reset(): void {
    this.failsLeft = this.config.failFirst ?? 0;
    this.killArmed = this.config.killOnce ?? false;
  }

  /**
   * Выполняет `fn`, внедряя сбои согласно конфигу. При `enabled=false` —
   * прозрачный проброс (никакого влияния на поведение).
   */
  async inject<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.config.enabled) return fn();

    if (this.config.slowMs && this.config.slowMs > 0) {
      await sleep(this.config.slowMs);
    }

    if (this.failsLeft > 0) {
      this.failsLeft -= 1;
      throw new ExternalServiceError({
        internalMessage: "chaos: инъекция транзиентной ошибки",
        details: { fault: "error" satisfies ChaosFaultKind },
      });
    }

    if (this.killArmed) {
      this.killArmed = false;
      throw new WorkerKilledError();
    }

    if (this.config.errorRate && this.rng() < this.config.errorRate) {
      throw new ExternalServiceError({
        internalMessage: "chaos: инъекция случайной ошибки",
        details: { fault: "error" satisfies ChaosFaultKind, errorRate: this.config.errorRate },
      });
    }

    return fn();
  }
}
