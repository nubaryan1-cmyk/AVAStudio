import { describe, expect, it, vi } from "vitest";

import { isBrokenCircuitError } from "./breaker.js";
import {
  POLICIES,
  aiPolicy,
  callWithPolicy,
  externalApiPolicy,
  paymentPolicy,
  socialPolicy,
  type PolicyName,
} from "./policies.js";

const policyEntries = Object.entries(POLICIES) as [PolicyName, (typeof POLICIES)[PolicyName]][];

describe("resilience/policies", () => {
  it("все политики имеют timeout, ограниченный retry и breaker", () => {
    for (const [name, policy] of policyEntries) {
      expect(policy.timeoutMs, name).toBeGreaterThan(0);
      expect(policy.breaker, name).toBeDefined();
      // retry присутствует и ограничен (нет бесконтрольных повторов).
      expect(policy.retry, name).not.toBe(false);
      if (policy.retry) {
        expect(policy.retry.maxAttempts ?? 0, name).toBeGreaterThanOrEqual(1);
        expect(policy.retry.maxAttempts ?? 0, name).toBeLessThanOrEqual(3);
      }
    }
  });

  it("payment осторожнее external: меньше ретраев", () => {
    const pay = paymentPolicy.retry !== false ? paymentPolicy.retry?.maxAttempts ?? 0 : 0;
    const ext = externalApiPolicy.retry !== false ? externalApiPolicy.retry?.maxAttempts ?? 0 : 0;
    expect(pay).toBeLessThan(ext);
  });

  it("ai имеет самый длинный timeout", () => {
    const timeouts = policyEntries.map(([, p]) => p.timeoutMs ?? 0);
    expect(aiPolicy.timeoutMs).toBe(Math.max(...timeouts));
  });

  it("callWithPolicy повторяет транзиентную ошибку и возвращает успех (social)", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 2) throw new Error("transient");
      return "ok";
    });
    await expect(callWithPolicy(socialPolicy, fn)).resolves.toBe("ok");
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("callWithPolicy: breaker размыкается после серии падений → fail-fast", async () => {
    // Своя политика с маленьким порогом и без агрессивных задержек — для скорости.
    const { circuitBreaker, handleAll, ConsecutiveBreaker } = await import("cockatiel");
    const policy = {
      timeoutMs: 1_000,
      retry: { maxAttempts: 1, backoff: { initialDelay: 1, maxDelay: 2 } } as const,
      breaker: circuitBreaker(handleAll, {
        halfOpenAfter: 10_000,
        breaker: new ConsecutiveBreaker(2),
      }),
    };
    const fn = vi.fn(async () => {
      throw new Error("down");
    });
    // 2 падения (каждый вызов = 1 попытка + 1 ретрай, но ретрай транзиентный) → откроем breaker.
    await expect(callWithPolicy(policy, fn)).rejects.toThrow();
    await expect(callWithPolicy(policy, fn)).rejects.toThrow();
    const before = fn.mock.calls.length;
    // Теперь breaker open → следующий вызов мгновенный, fn не дёргается.
    await expect(callWithPolicy(policy, fn)).rejects.toSatisfy(isBrokenCircuitError);
    expect(fn.mock.calls.length).toBe(before);
  });
});
