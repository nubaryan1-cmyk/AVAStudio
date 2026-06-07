import { describe, expect, it } from "vitest";

import { asSocialAccountId } from "../domain/ids.js";

import {
  WARMUP_TOTAL_DAYS,
  assertReadyToPost,
  clampWarmupDay,
  escalationFactor,
  isWarmedUp,
  planWarmupSession,
  warmupDay,
  type WarmupState,
} from "./warmup.js";

describe("warmup engine", () => {
  it("эскалация: день 14 даёт больше действий/длительности, чем день 1", () => {
    const d1 = planWarmupSession("instagram", 1);
    const d14 = planWarmupSession("instagram", 14);
    expect(escalationFactor(1)).toBeLessThan(escalationFactor(14));
    expect(d14.durationMs).toBeGreaterThan(d1.durationMs);
    expect(d14.actions.length).toBeGreaterThan(d1.actions.length);
  });

  it("план содержит только действия, разрешённые платформе", () => {
    const plan = planWarmupSession("reddit", 10);
    for (const action of plan.actions) {
      expect(["scroll_feed", "like"]).toContain(action.kind);
      expect(action.pauseMs).toBeGreaterThanOrEqual(800);
    }
  });

  it("clampWarmupDay и warmupDay ограничены 1..14", () => {
    expect(clampWarmupDay(0)).toBe(1);
    expect(clampWarmupDay(99)).toBe(WARMUP_TOTAL_DAYS);
    const start = new Date("2026-01-01T00:00:00Z");
    expect(warmupDay(start, new Date("2026-01-01T05:00:00Z"))).toBe(1);
    expect(warmupDay(start, new Date("2026-01-05T00:00:00Z"))).toBe(5);
    expect(warmupDay(start, new Date("2026-03-01T00:00:00Z"))).toBe(WARMUP_TOTAL_DAYS);
  });

  it("недопрогретый аккаунт блокируется к постингу", () => {
    const state: WarmupState = {
      accountId: asSocialAccountId("acc-1"),
      platform: "instagram",
      warmupStage: 5,
    };
    expect(isWarmedUp(state)).toBe(false);
    expect(() => assertReadyToPost(state)).toThrow(/не прогрет/);
  });

  it("прогретый аккаунт допускается к постингу", () => {
    const state: WarmupState = {
      accountId: asSocialAccountId("acc-2"),
      platform: "instagram",
      warmupStage: WARMUP_TOTAL_DAYS,
    };
    expect(isWarmedUp(state)).toBe(true);
    expect(() => assertReadyToPost(state)).not.toThrow();
  });
});
