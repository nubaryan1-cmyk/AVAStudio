import { ExternalServiceError } from "@avastudio/shared";
import { describe, expect, it, vi } from "vitest";

import { ChaosController, WorkerKilledError } from "./chaos.js";

describe("ChaosController", () => {
  it("при enabled=false — прозрачный проброс, без сбоев", async () => {
    const c = new ChaosController({ enabled: false, errorRate: 1, killOnce: true });
    await expect(c.inject(async () => "ok")).resolves.toBe("ok");
  });

  it("failFirst=N бросает ошибку первые N раз, затем выполняет", async () => {
    const c = new ChaosController({ enabled: true, failFirst: 2 });
    await expect(c.inject(async () => "ok")).rejects.toBeInstanceOf(ExternalServiceError);
    await expect(c.inject(async () => "ok")).rejects.toBeInstanceOf(ExternalServiceError);
    await expect(c.inject(async () => "ok")).resolves.toBe("ok");
  });

  it("killOnce имитирует убийство воркера один раз", async () => {
    const c = new ChaosController({ enabled: true, killOnce: true });
    await expect(c.inject(async () => "ok")).rejects.toBeInstanceOf(WorkerKilledError);
    await expect(c.inject(async () => "ok")).resolves.toBe("ok");
  });

  it("errorRate с детерминированным rng", async () => {
    const c = new ChaosController({ enabled: true, errorRate: 0.5, rng: () => 0.1 });
    await expect(c.inject(async () => "ok")).rejects.toBeInstanceOf(ExternalServiceError);
    const c2 = new ChaosController({ enabled: true, errorRate: 0.5, rng: () => 0.9 });
    await expect(c2.inject(async () => "ok")).resolves.toBe("ok");
  });

  it("slowMs добавляет задержку перед выполнением", async () => {
    vi.useFakeTimers();
    try {
      const c = new ChaosController({ enabled: true, slowMs: 1000 });
      const fn = vi.fn(async () => "ok");
      const p = c.inject(fn);
      expect(fn).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1000);
      await expect(p).resolves.toBe("ok");
    } finally {
      vi.useRealTimers();
    }
  });

  it("assertDevOnly запрещает production", () => {
    expect(() => ChaosController.assertDevOnly("production")).toThrow();
    expect(() => ChaosController.assertDevOnly("development")).not.toThrow();
  });
});
