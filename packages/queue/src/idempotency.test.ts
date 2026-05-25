import { describe, expect, it } from "vitest";

import { buildJobId, claimIdempotencyKey, type IdempotencyStore } from "./idempotency.js";

describe("buildJobId", () => {
  it("детерминирован: одинаковые данные → одинаковый id", () => {
    const a = buildJobId("render-video", { assetId: "x", preset: { b: 1, c: 2 } });
    const b = buildJobId("render-video", { assetId: "x", preset: { b: 1, c: 2 } });
    expect(a).toBe(b);
  });

  it("не зависит от порядка ключей", () => {
    const a = buildJobId("post-instagram", { a: 1, b: 2 });
    const b = buildJobId("post-instagram", { b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("разные данные → разные id", () => {
    expect(buildJobId("render-video", { assetId: "x" })).not.toBe(
      buildJobId("render-video", { assetId: "y" }),
    );
  });

  it("разные очереди → разные id", () => {
    expect(buildJobId("post-tiktok", { a: 1 })).not.toBe(buildJobId("post-reddit", { a: 1 }));
  });

  it("содержит префикс очереди", () => {
    expect(buildJobId("send-email", { to: "a@b.dev" })).toMatch(/^send-email:/);
  });
});

describe("claimIdempotencyKey (SETNX/TTL)", () => {
  // Точная эмуляция SET ... EX .. NX через Map.
  function fakeStore(): IdempotencyStore {
    const keys = new Set<string>();
    return {
      set: (key) => Promise.resolve(keys.has(key) ? null : (keys.add(key), "OK")),
    };
  }

  it("первый вызов → true, повторный → false (дубликат)", async () => {
    const store = fakeStore();
    expect(await claimIdempotencyKey("req-1", { store })).toBe(true);
    expect(await claimIdempotencyKey("req-1", { store })).toBe(false);
  });

  it("разные ключи независимы", async () => {
    const store = fakeStore();
    expect(await claimIdempotencyKey("a", { store })).toBe(true);
    expect(await claimIdempotencyKey("b", { store })).toBe(true);
  });
});
