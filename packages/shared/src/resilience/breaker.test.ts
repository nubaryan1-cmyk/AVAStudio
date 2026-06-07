import { describe, expect, it, vi } from "vitest";

import {
  withBreaker,
  isBrokenCircuitError,
  type BreakerStateChange,
} from "./breaker.js";

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe("withBreaker", () => {
  it("стартует в состоянии closed", () => {
    const b = withBreaker("svc", async () => "ok");
    expect(b.state).toBe("closed");
    expect(b.name).toBe("svc");
  });

  it("после N последовательных ошибок размыкается (open) и падает мгновенно", async () => {
    const changes: BreakerStateChange[] = [];
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });
    const b = withBreaker("svc", failing, {
      threshold: 3,
      halfOpenAfter: 1000,
      onStateChange: (e) => changes.push(e),
    });

    for (let i = 0; i < 3; i += 1) {
      await expect(b.run()).rejects.toThrow("boom");
    }
    expect(b.state).toBe("open");

    // Следующий вызов — fail-fast: реальная функция уже не дёргается.
    const callsBefore = failing.mock.calls.length;
    await expect(b.run()).rejects.toSatisfy(isBrokenCircuitError);
    expect(failing.mock.calls.length).toBe(callsBefore);

    expect(changes.some((c) => c.to === "open")).toBe(true);
  });

  it("через halfOpenAfter переходит в half-open, успех закрывает брейкер", async () => {
    const changes: BreakerStateChange[] = [];
    let mode: "fail" | "ok" = "fail";
    const fn = vi.fn(async () => {
      if (mode === "fail") throw new Error("boom");
      return "ok";
    });
    const b = withBreaker("svc", fn, {
      threshold: 2,
      halfOpenAfter: 60,
      onStateChange: (e) => changes.push(e),
    });

    await expect(b.run()).rejects.toThrow("boom");
    await expect(b.run()).rejects.toThrow("boom");
    expect(b.state).toBe("open");

    await sleep(80);
    mode = "ok";
    await expect(b.run()).resolves.toBe("ok");
    expect(b.state).toBe("closed");

    expect(changes.map((c) => c.to)).toContain("half-open");
    expect(changes.map((c) => c.to)).toContain("closed");
  });

  it("isolate() принудительно размыкает, возврат восстанавливает", async () => {
    const b = withBreaker("svc", async () => "ok");
    const restore = b.isolate();
    expect(b.state).toBe("isolated");
    await expect(b.run()).rejects.toSatisfy(isBrokenCircuitError);
    restore();
    expect(b.state).toBe("closed");
    await expect(b.run()).resolves.toBe("ok");
  });
});
