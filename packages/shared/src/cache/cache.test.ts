import { describe, expect, it, vi } from "vitest";

import { cached, InMemoryCache, NO_STORE, publicCacheControl } from "./index.js";

describe("caching (25.2)", () => {
  it("cache-aside: loader runs once, then served from cache", async () => {
    const cache = new InMemoryCache();
    const loader = vi.fn(() => Promise.resolve({ n: 1 }));
    expect(await cached(cache, "k", 60, loader)).toEqual({ n: 1 });
    expect(await cached(cache, "k", 60, loader)).toEqual({ n: 1 });
    expect(loader).toHaveBeenCalledOnce();
  });
  it("ttl expiry re-runs loader", async () => {
    let t = 0;
    const cache = new InMemoryCache(() => t);
    const loader = vi.fn(() => Promise.resolve(t));
    await cached(cache, "k", 1, loader);
    t += 2000;
    await cached(cache, "k", 1, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
  it("cache-control headers", () => {
    expect(publicCacheControl(60)).toContain("stale-while-revalidate");
    expect(NO_STORE).toContain("no-store");
  });
});
