import {
  buildJobId,
  claimIdempotencyKey,
  handleFailedJob,
  type DeadLetterRecord,
  type FailedJobLike,
  type IdempotencyStore,
} from "@avastudio/queue";
import { isBrokenCircuitError, withBreaker } from "@avastudio/shared/resilience";
import { describe, expect, it, vi } from "vitest";

import { ChaosController, WorkerKilledError } from "./chaos.js";

/** Фейковый Redis-store с семантикой SET key val EX ttl NX (для idempotency). */
function fakeIdempotencyStore(): IdempotencyStore {
  const map = new Map<string, string>();
  return {
    set: async (key, value) => {
      if (map.has(key)) return null;
      map.set(key, value);
      return "OK";
    },
  };
}

describe("chaos-инварианты устойчивости (TASK 8.4)", () => {
  it("kill воркера во время задачи → задача НЕ теряется (уходит в DLQ после ретраев)", async () => {
    // kill на 1-й попытке, далее job продолжает падать (внешний сбой) → все 3 попытки неуспешны.
    const chaos = new ChaosController({ enabled: true, killOnce: true, errorRate: 1, rng: () => 0 });
    const job: FailedJobLike = {
      id: "job-1",
      name: "render-video",
      data: { orgId: "o1" },
      attemptsMade: 0,
      opts: { attempts: 3 },
    };

    const dlq: DeadLetterRecord[] = [];
    const sink = async (r: DeadLetterRecord): Promise<void> => void dlq.push(r);

    // Эмулируем 3 попытки BullMQ: каждая падает (kill на 1-й, дальше тоже считаем сбоем).
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      let error: Error | null = null;
      try {
        await chaos.inject(async () => "done");
      } catch (e) {
        error = e as Error;
        if (attempt === 1) expect(e).toBeInstanceOf(WorkerKilledError);
      }
      job.attemptsMade = attempt;
      if (error) await handleFailedJob("render-video", job, error, sink);
    }

    // Инвариант: после исчерпания попыток задача сохранена в DLQ (не потеряна).
    expect(dlq).toHaveLength(1);
    expect(dlq[0]?.originalJobId).toBe("job-1");
    expect(dlq[0]?.data).toEqual({ orgId: "o1" });
  });

  it("идемпотентность держит: одинаковые данные → один jobId и одна обработка", async () => {
    const data = { orgId: "o1", sourceAssetId: "a1", variants: 3 };
    // Детерминированный jobId → BullMQ дедуплицирует постановку.
    expect(buildJobId("unique-media", data)).toBe(buildJobId("unique-media", { ...data }));

    // На уровне обработки: повторный claim ключа не даёт второй обработки.
    const store = fakeIdempotencyStore();
    const key = buildJobId("unique-media", data);
    let processed = 0;
    const processOnce = async (): Promise<void> => {
      if (await claimIdempotencyKey(key, { store })) processed += 1;
    };
    await processOnce();
    await processOnce(); // дубль (например, после kill/повторной доставки)
    expect(processed).toBe(1);
  });

  it("серия chaos-ошибок размыкает breaker (fail-fast, внешний сервис не нагружается)", async () => {
    const chaos = new ChaosController({ enabled: true, errorRate: 1, rng: () => 0 });
    const upstream = vi.fn(async () => "ok");
    const breaker = withBreaker("chaos-svc", () => chaos.inject(upstream), {
      threshold: 3,
      halfOpenAfter: 10_000,
    });

    for (let i = 0; i < 3; i += 1) {
      await expect(breaker.run()).rejects.toThrow();
    }
    expect(breaker.state).toBe("open");

    const callsBefore = upstream.mock.calls.length;
    await expect(breaker.run()).rejects.toSatisfy(isBrokenCircuitError);
    // Инвариант: на open-breaker реальный вызов не происходит.
    expect(upstream.mock.calls.length).toBe(callsBefore);
  });
});
