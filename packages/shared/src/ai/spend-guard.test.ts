import { describe, expect, it } from "vitest";

import { checkSpendCap, detectCostAnomaly, rateConfigFor } from "./spend-guard.js";

describe("rate config (21.3)", () => {
  it("returns per-provider config, default fallback", () => {
    expect(rateConfigFor("runway-video").maxConcurrency).toBe(3);
    expect(rateConfigFor("unknown").requestsPerSecond).toBe(2);
  });
});

describe("spend cap (21.3)", () => {
  const caps = { orgDailyCapUsd: "10", systemDailyCapUsd: "100" };
  it("allows within caps", () => {
    expect(checkSpendCap({ spentTodayUsd: "1", costUsd: "2", ...caps }).allowed).toBe(true);
  });
  it("blocks at org cap", () => {
    const d = checkSpendCap({ spentTodayUsd: "9", costUsd: "2", ...caps });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("org_cap");
  });
  it("blocks at system cap first", () => {
    const d = checkSpendCap({ spentTodayUsd: "99", costUsd: "2", orgDailyCapUsd: "1000", systemDailyCapUsd: "100" });
    expect(d.reason).toBe("system_cap");
  });
});

describe("cost anomaly (21.2)", () => {
  it("flags 3x+ spikes above min", () => {
    expect(detectCostAnomaly("30", "5").anomalous).toBe(true);
  });
  it("ignores small absolute spend", () => {
    expect(detectCostAnomaly("4", "0.5").anomalous).toBe(false);
  });
  it("not anomalous when within factor", () => {
    expect(detectCostAnomaly("10", "5").anomalous).toBe(false);
  });
});
