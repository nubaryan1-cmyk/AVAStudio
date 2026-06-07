import { describe, expect, it } from "vitest";

import { InMemoryCounterStore, RATE_RULES, rateLimit, rateLimitHeaders } from "./index.js";

describe("rate limiting (TASK 23.2)", () => {
  it("allows under limit, blocks over", async () => {
    const store = new InMemoryCounterStore();
    const rule = { limit: 3, windowSec: 60 };
    let d = await rateLimit(store, "ip:1", rule);
    expect(d.allowed).toBe(true);
    expect(d.remaining).toBe(2);
    await rateLimit(store, "ip:1", rule);
    await rateLimit(store, "ip:1", rule);
    d = await rateLimit(store, "ip:1", rule);
    expect(d.allowed).toBe(false);
    expect(d.retryAfterSec).toBeGreaterThan(0);
  });

  it("window resets after expiry", async () => {
    let t = 1000;
    const store = new InMemoryCounterStore(() => t);
    const rule = { limit: 1, windowSec: 10 };
    expect((await rateLimit(store, "k", rule)).allowed).toBe(true);
    expect((await rateLimit(store, "k", rule)).allowed).toBe(false);
    t += 11_000;
    expect((await rateLimit(store, "k", rule)).allowed).toBe(true);
  });

  it("separate keys independent", async () => {
    const store = new InMemoryCounterStore();
    const rule = RATE_RULES.render;
    expect((await rateLimit(store, "org:a", rule)).allowed).toBe(true);
    expect((await rateLimit(store, "org:b", rule)).allowed).toBe(true);
  });

  it("headers include Retry-After when blocked", async () => {
    const store = new InMemoryCounterStore();
    const rule = { limit: 1, windowSec: 60 };
    await rateLimit(store, "x", rule);
    const h = rateLimitHeaders(await rateLimit(store, "x", rule));
    expect(h["Retry-After"]).toBeDefined();
  });
});
