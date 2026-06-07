import { describe, expect, it } from "vitest";

import { asSocialAccountId } from "../domain/ids.js";

import {
  SHADOWBAN_REACH_RATIO,
  applySignal,
  assertPostAllowed,
  checkPostAllowed,
  detectShadowban,
  freshWindow,
  isStopped,
  limitsFor,
  nextActionPauseMs,
  randomizedCaption,
  registerPost,
  rollWindow,
  type AccountHealth,
} from "./anti-ban.js";

const NOW = new Date("2026-01-01T12:00:00Z");

function health(over: Partial<AccountHealth> = {}): AccountHealth {
  return {
    accountId: asSocialAccountId("acc-1"),
    platform: "instagram",
    healthScore: 80,
    status: "active",
    consecutiveErrors: 0,
    recentReach: [],
    ...over,
  };
}

describe("anti-ban", () => {
  it("превышение лимита постов/день блокируется", () => {
    const limits = limitsFor("instagram"); // maxPostsPerDay=3
    let win = freshWindow(NOW);
    for (let i = 0; i < limits.maxPostsPerDay; i += 1) {
      expect(checkPostAllowed(limits, win, NOW).allowed).toBe(true);
      win = registerPost(win, NOW);
    }
    const decision = checkPostAllowed(limits, win, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/постов\/день/);
    expect(() => assertPostAllowed(limits, win, NOW)).toThrow(/anti-ban/);
  });

  it("счётчик постов/день сбрасывается на следующие сутки", () => {
    const limits = limitsFor("instagram");
    let win = freshWindow(NOW);
    win = registerPost(win, NOW);
    win = registerPost(win, NOW);
    win = registerPost(win, NOW);
    const nextDay = new Date(NOW.getTime() + 86_400_000 + 1000);
    const rolled = rollWindow(win, nextDay);
    expect(rolled.postsToday).toBe(0);
    expect(checkPostAllowed(limits, rolled, nextDay).allowed).toBe(true);
  });

  it("паузы рандомны и в пределах [min,max]", () => {
    const limits = limitsFor("instagram");
    for (let i = 0; i < 50; i += 1) {
      const pause = nextActionPauseMs(limits);
      expect(pause).toBeGreaterThanOrEqual(limits.minPauseMs);
      expect(pause).toBeLessThanOrEqual(limits.maxPauseMs);
    }
  });

  it("рандомизация подписи выбирает из вариантов", () => {
    const variants = ["a", "b", "c"];
    expect(variants).toContain(randomizedCaption(variants));
  });

  it("checkpoint от платформы → авто-стоп + флаг", () => {
    const updated = applySignal(health(), { kind: "checkpoint" }, NOW);
    expect(updated.status).toBe("checkpoint");
    expect(updated.healthScore).toBe(0);
    expect(updated.lastCheckpointAt).toEqual(NOW);
    expect(isStopped(updated)).toBe(true);
  });

  it("error снижает health_score и растит счётчик ошибок", () => {
    const updated = applySignal(health({ healthScore: 50 }), { kind: "error" }, NOW);
    expect(updated.healthScore).toBeLessThan(50);
    expect(updated.consecutiveErrors).toBe(1);
  });

  it("детектор shadowban: падение reach ниже порога → авто-пауза", () => {
    const base = health({ baselineReach: 1000, recentReach: [] });
    // baseline*ratio = 300; подаём низкий reach несколько раз
    let h = applySignal(base, { kind: "ok", reach: 100 }, NOW);
    h = applySignal(h, { kind: "ok", reach: 80 }, NOW);
    h = applySignal(h, { kind: "ok", reach: 90 }, NOW);
    expect(detectShadowban(h)).toBe(true);
    expect(h.status).toBe("checkpoint");
    expect(isStopped(h)).toBe(true);
  });

  it("здоровый reach не триггерит shadowban", () => {
    const base = health({ baselineReach: 1000, recentReach: [] });
    let h = applySignal(base, { kind: "ok", reach: 900 }, NOW);
    h = applySignal(h, { kind: "ok", reach: 850 }, NOW);
    h = applySignal(h, { kind: "ok", reach: 950 }, NOW);
    expect(detectShadowban(h)).toBe(false);
    expect(h.status).toBe("active");
    expect(SHADOWBAN_REACH_RATIO).toBe(0.3);
  });
});
