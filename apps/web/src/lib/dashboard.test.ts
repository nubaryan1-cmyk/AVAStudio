import { PLANS } from "@avastudio/shared/billing";
import { describe, expect, it } from "vitest";


import { createCaller } from "../server/routers/_app.js";

import { METRIC_LABELS, usagePercent } from "./dashboard.js";

describe("usagePercent", () => {
  it("возвращает 0 для безлимита (null)", () => {
    expect(usagePercent(500, null)).toBe(0);
  });

  it("возвращает 0 при лимите <= 0", () => {
    expect(usagePercent(10, 0)).toBe(0);
  });

  it("считает процент и округляет", () => {
    expect(usagePercent(50, 100)).toBe(50);
    expect(usagePercent(1, 3)).toBe(33);
  });

  it("ограничивает максимум до 100", () => {
    expect(usagePercent(250, 100)).toBe(100);
  });
});

describe("dashboard.summary", () => {
  const caller = createCaller({});

  it("возвращает виджеты на локальных данных", async () => {
    const data = await caller.dashboard.summary();

    expect(data.accountsCount).toBeGreaterThan(0);
    expect(data.postsThisWeek).toBeGreaterThan(0);
    expect(data.recentJobs.length).toBeGreaterThan(0);
    expect(data.issues.length).toBeGreaterThan(0);
  });

  it("usage покрывает все лимиты тарифа pro", async () => {
    const data = await caller.dashboard.summary();
    const metrics = data.usage.map((u) => u.metric).sort();
    const planMetrics = Object.keys(PLANS.pro.limits).sort();

    expect(metrics).toEqual(planMetrics);
    for (const row of data.usage) {
      expect(METRIC_LABELS[row.metric]).toBeTruthy();
      expect(usagePercent(row.used, row.limit)).toBeGreaterThanOrEqual(0);
      expect(usagePercent(row.used, row.limit)).toBeLessThanOrEqual(100);
    }
  });
});
