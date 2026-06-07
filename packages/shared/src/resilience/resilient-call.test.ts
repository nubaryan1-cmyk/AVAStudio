import { describe, expect, it, vi } from "vitest";

import { withBreaker, isBrokenCircuitError } from "./breaker.js";
import { resilientCall } from "./resilient-call.js";

describe("resilientCall", () => {
  it("повторяет транзиентную ошибку и возвращает успех", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error("transient");
      return "ok";
    });
    const result = await resilientCall(fn, {
      retry: { maxAttempts: 3, backoff: { initialDelay: 1, maxDelay: 5 } },
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("без опций просто исполняет функцию один раз", async () => {
    const fn = vi.fn(async () => 42);
    await expect(resilientCall(fn)).resolves.toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("прерывает медленную попытку по timeoutMs", async () => {
    const fn = vi.fn(
      () => new Promise<string>((resolve) => setTimeout(() => resolve("late"), 200)),
    );
    await expect(
      resilientCall(fn, { timeoutMs: 30, retry: false }),
    ).rejects.toThrow();
  });

  it("не повторяет fail-fast разомкнутого брейкера", async () => {
    const failing = vi.fn(async () => {
      throw new Error("boom");
    });
    const breaker = withBreaker("svc", failing, { threshold: 2, halfOpenAfter: 1000 });

    // Разомкнём брейкер прямыми вызовами.
    await expect(breaker.run()).rejects.toThrow("boom");
    await expect(breaker.run()).rejects.toThrow("boom");
    expect(breaker.state).toBe("open");

    const callsBefore = failing.mock.calls.length;
    // resilientCall с ретраями: на open-брейкере не должно быть лишних вызовов fn.
    await expect(
      resilientCall(() => breaker.run(), {
        breaker,
        retry: { maxAttempts: 5, backoff: { initialDelay: 1, maxDelay: 2 } },
      }),
    ).rejects.toSatisfy(isBrokenCircuitError);
    expect(failing.mock.calls.length).toBe(callsBefore);
  });
});
