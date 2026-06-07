import { describe, expect, it } from "vitest";

import { asOrgId } from "../domain/ids.js";

import { assertWithinLimit } from "./entitlements.js";
import {
  InMemoryUsageRepository,
  aggregateDaily,
  dayKey,
  getUsageForPeriod,
  recordUsage,
} from "./usage.js";

const org = asOrgId("org_1");

describe("usage metering (TASK 9.5)", () => {
  it("пишет события и агрегирует за сутки", async () => {
    const repo = new InMemoryUsageRepository();
    const t = new Date("2026-05-30T10:00:00.000Z");
    await recordUsage(repo, org, "renders", 1, t);
    await recordUsage(repo, org, "renders", 2, t);
    await recordUsage(repo, org, "videoMinutes", 5, t);

    const rows = await aggregateDaily(repo, org, "2026-05-30");
    const renders = rows.find((r) => r.metric === "renders");
    const minutes = rows.find((r) => r.metric === "videoMinutes");
    expect(renders?.total).toBe(3);
    expect(minutes?.total).toBe(5);

    const stored = await repo.getDaily(org, "renders", "2026-05-30");
    expect(stored?.total).toBe(3);
  });

  it("агрегация идемпотентна (повторный прогон → тот же агрегат)", async () => {
    const repo = new InMemoryUsageRepository();
    const t = new Date("2026-05-30T12:00:00.000Z");
    await recordUsage(repo, org, "posts", 4, t);
    await aggregateDaily(repo, org, "2026-05-30");
    await aggregateDaily(repo, org, "2026-05-30");
    const stored = await repo.getDaily(org, "posts", "2026-05-30");
    expect(stored?.total).toBe(4);
  });

  it("учитывает только события внутри суток", async () => {
    const repo = new InMemoryUsageRepository();
    await recordUsage(repo, org, "renders", 1, new Date("2026-05-30T23:59:59.000Z"));
    await recordUsage(repo, org, "renders", 1, new Date("2026-05-31T00:00:01.000Z"));
    const rows = await aggregateDaily(repo, org, "2026-05-30");
    expect(rows.find((r) => r.metric === "renders")?.total).toBe(1);
  });

  it("getUsageForPeriod строит контекст для entitlements", async () => {
    const repo = new InMemoryUsageRepository();
    const t = new Date("2026-05-30T08:00:00.000Z");
    await recordUsage(repo, org, "aiGenerations", 3, t);
    const usage = await getUsageForPeriod(
      repo,
      org,
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-06-01T00:00:00.000Z"),
    );
    expect(usage.aiGenerations).toBe(3);
  });

  it("превышение лимита → PaymentRequiredError (связь с 9.2)", async () => {
    const repo = new InMemoryUsageRepository();
    const t = new Date("2026-05-30T08:00:00.000Z");
    // starter: renders лимит. Набьём использование выше лимита и проверим.
    await recordUsage(repo, org, "renders", 1000, t);
    const usage = await getUsageForPeriod(
      repo,
      org,
      new Date("2026-05-01T00:00:00.000Z"),
      new Date("2026-06-01T00:00:00.000Z"),
    );
    expect(() => assertWithinLimit({ planId: "starter", usage }, "renders", 1)).toThrow();
  });

  it("recordUsage отвергает неположительный amount", async () => {
    const repo = new InMemoryUsageRepository();
    await expect(recordUsage(repo, org, "renders", 0)).rejects.toThrow();
  });

  it("dayKey даёт UTC YYYY-MM-DD", () => {
    expect(dayKey(new Date("2026-05-30T23:30:00.000Z"))).toBe("2026-05-30");
  });
});
