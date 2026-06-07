import { describe, expect, it } from "vitest";

import { accountRiskScore, activityMultiplier, proxyReputation, rankProxies, riskLevel, shouldRetireProxy } from "./index.js";

describe("account risk (25.5)", () => {
  it("clean aged warmed account = low risk", () => {
    const s = accountRiskScore({ checkpoints30d: 0, avgReachRatio: 1, ageDays: 200, warmedUp: true });
    expect(riskLevel(s)).toBe("low");
    expect(activityMultiplier(s)).toBe(1);
  });
  it("checkpoints + low reach + young = high risk → reduced activity", () => {
    const s = accountRiskScore({ checkpoints30d: 3, avgReachRatio: 0.2, ageDays: 5, warmedUp: false });
    expect(riskLevel(s)).toBe("high");
    expect(activityMultiplier(s)).toBeLessThan(0.5);
  });
});

describe("proxy reputation (25.5)", () => {
  it("good proxy high reputation", () => {
    expect(proxyReputation({ proxyId: "p", success: 95, fail: 5 })).toBeGreaterThan(0.8);
  });
  it("retires bad proxy with enough samples", () => {
    expect(shouldRetireProxy({ proxyId: "p", success: 3, fail: 12 })).toBe(true);
    expect(shouldRetireProxy({ proxyId: "p", success: 1, fail: 1 })).toBe(false); // мало данных
  });
  it("ranks better proxies first", () => {
    const ranked = rankProxies([
      { proxyId: "bad", success: 5, fail: 20 },
      { proxyId: "good", success: 50, fail: 2 },
    ]);
    expect(ranked[0]?.proxyId).toBe("good");
  });
});
