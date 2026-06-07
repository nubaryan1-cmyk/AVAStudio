import { describe, expect, it } from "vitest";

import { costPerAction, totalCost, unprofitableUsers, userMargin } from "./index.js";

describe("unit economics (25.6)", () => {
  it("totalCost sums components", () => {
    expect(totalCost({ ai: 0.1, render: 0.2, posting: 0.05, storage: 0.01 })).toBe(0.36);
  });
  it("margin and unprofitable flag", () => {
    const m = userMargin({ userId: "u", costs: { ai: 25, render: 5, posting: 2, storage: 1 }, revenue: 19.99 });
    expect(m.unprofitable).toBe(true);
    expect(m.margin).toBeLessThan(0);
  });
  it("profitable user", () => {
    const m = userMargin({ userId: "u", costs: { ai: 2, render: 1, posting: 0.5, storage: 0.1 }, revenue: 49.99 });
    expect(m.unprofitable).toBe(false);
    expect(m.marginPct).toBeGreaterThan(0);
  });
  it("costPerAction and unprofitableUsers filter", () => {
    expect(costPerAction({ ai: 1, render: 1, posting: 0, storage: 0 }, 4)).toBe(0.5);
    const losers = unprofitableUsers([
      { userId: "a", costs: { ai: 100, render: 0, posting: 0, storage: 0 }, revenue: 20 },
      { userId: "b", costs: { ai: 1, render: 0, posting: 0, storage: 0 }, revenue: 20 },
    ]);
    expect(losers.map((l) => l.userId)).toEqual(["a"]);
  });
});
