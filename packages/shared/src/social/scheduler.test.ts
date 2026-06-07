import { describe, expect, it } from "vitest";

import { asOrgId, asSocialAccountId } from "../domain/ids.js";
import { getHourInTz } from "../utils/datetime.js";

import { limitsFor } from "./anti-ban.js";
import {
  InMemoryPostingJobRepository,
  isDueForEnqueue,
  isEligible,
  planSchedule,
  postingJobId,
  type SchedulableAccount,
} from "./scheduler.js";
import { WARMUP_TOTAL_DAYS } from "./warmup.js";

import type { AccountHealth } from "./anti-ban.js";
import type { Platform } from "../domain/enums.js";

const ORG = asOrgId("org-1");
const TZ = "Europe/Moscow";

function account(i: number, over: { warmedUp?: boolean; stopped?: boolean; platform?: Platform } = {}): SchedulableAccount {
  const platform = over.platform ?? "instagram";
  const id = asSocialAccountId(`acc-${i}`);
  const health: AccountHealth = {
    accountId: id,
    platform,
    healthScore: 90,
    status: over.stopped === true ? "checkpoint" : "active",
    consecutiveErrors: 0,
    recentReach: [],
  };
  return {
    accountId: id,
    platform,
    timeZone: TZ,
    warmup: { accountId: id, platform, warmupStage: over.warmedUp === false ? 3 : WARMUP_TOTAL_DAYS },
    health,
  };
}

describe("multi-account scheduler", () => {
  it("50 видео × 10 аккаунтов: всё размещено, лимиты соблюдены, прайм-тайм учтён", () => {
    const accounts = Array.from({ length: 10 }, (_, i) => account(i));
    const assetIds = Array.from({ length: 50 }, (_, i) => `asset-${i}`);
    const { jobs, unscheduled } = planSchedule({
      orgId: ORG,
      assetIds,
      accounts,
      startDate: new Date("2026-06-01T00:00:00Z"),
    });
    expect(unscheduled).toHaveLength(0);
    expect(jobs).toHaveLength(50);

    // Лимит постов/день per account per day соблюдён.
    const maxPerDay = limitsFor("instagram").maxPostsPerDay;
    const perAccountDay = new Map<string, number>();
    for (const job of jobs) {
      const dayKey = `${job.accountId}|${job.scheduledAt.toISOString().slice(0, 10)}`;
      const n = (perAccountDay.get(dayKey) ?? 0) + 1;
      perAccountDay.set(dayKey, n);
      expect(n).toBeLessThanOrEqual(maxPerDay);
    }

    // Прайм-тайм: каждый слот в окне 18:00–22:00 по таймзоне аккаунта.
    for (const job of jobs) {
      const hour = getHourInTz(job.scheduledAt, TZ);
      expect(hour).toBeGreaterThanOrEqual(18);
      expect(hour).toBeLessThan(22);
    }

    // Равномерность: каждый из 10 аккаунтов получил по 5 постов.
    const perAccount = new Map<string, number>();
    for (const job of jobs) {
      perAccount.set(job.accountId, (perAccount.get(job.accountId) ?? 0) + 1);
    }
    expect([...perAccount.values()]).toEqual(Array.from({ length: 10 }, () => 5));
  });

  it("идемпотентность: повторный планировщик не плодит дубли", async () => {
    const accounts = Array.from({ length: 3 }, (_, i) => account(i));
    const assetIds = Array.from({ length: 6 }, (_, i) => `asset-${i}`);
    const repo = new InMemoryPostingJobRepository();
    const startDate = new Date("2026-06-01T00:00:00Z");

    const first = planSchedule({ orgId: ORG, assetIds, accounts, startDate });
    await repo.saveAll(first.jobs);
    const sizeAfterFirst = repo.size;

    const existing = await repo.existingIds(ORG);
    const second = planSchedule({ orgId: ORG, assetIds, accounts, startDate }, existing);
    await repo.saveAll(second.jobs);

    expect(repo.size).toBe(sizeAfterFirst); // дублей нет
    // Детерминированный id стабилен.
    expect(postingJobId(ORG, accounts[0]!.accountId, "asset-0")).toBe(
      postingJobId(ORG, accounts[0]!.accountId, "asset-0"),
    );
  });

  it("неприемлемые аккаунты (непрогретые/остановленные) исключаются", () => {
    const warmed = account(0);
    const cold = account(1, { warmedUp: false });
    const stopped = account(2, { stopped: true });
    expect(isEligible(warmed)).toBe(true);
    expect(isEligible(cold)).toBe(false);
    expect(isEligible(stopped)).toBe(false);

    const { jobs } = planSchedule({
      orgId: ORG,
      assetIds: ["a-0", "a-1", "a-2"],
      accounts: [warmed, cold, stopped],
      startDate: new Date("2026-06-01T00:00:00Z"),
    });
    for (const job of jobs) {
      expect(job.accountId).toBe(warmed.accountId);
    }
  });

  it("нет подходящих аккаунтов → всё unscheduled", () => {
    const { jobs, unscheduled } = planSchedule({
      orgId: ORG,
      assetIds: ["a-0", "a-1"],
      accounts: [account(0, { stopped: true })],
      startDate: new Date("2026-06-01T00:00:00Z"),
    });
    expect(jobs).toHaveLength(0);
    expect(unscheduled).toEqual(["a-0", "a-1"]);
  });

  it("isDueForEnqueue: за ~5 минут до времени", () => {
    const now = new Date("2026-06-01T18:00:00Z");
    const soon = { scheduledAt: new Date(now.getTime() + 4 * 60_000) } as never;
    const later = { scheduledAt: new Date(now.getTime() + 30 * 60_000) } as never;
    expect(isDueForEnqueue(soon, now)).toBe(true);
    expect(isDueForEnqueue(later, now)).toBe(false);
  });
});
