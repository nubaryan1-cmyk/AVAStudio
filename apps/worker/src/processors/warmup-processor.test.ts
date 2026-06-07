import { createLogger } from "@avastudio/shared";
import { InMemoryWarmupRepository, WARMUP_TOTAL_DAYS } from "@avastudio/shared/social";
import { describe, expect, it } from "vitest";

import { createWarmupProcessor } from "./warmup-account.js";

import type { SocialAccountId } from "@avastudio/shared";
import type { Job } from "bullmq";

const ORG = "11111111-1111-4111-8111-111111111111";
const ACC = "22222222-2222-4222-8222-222222222222";
const silent = createLogger({ destination: { write: () => undefined } });

function fakeJob(data: unknown): Job {
  return { id: "job-w", data } as unknown as Job;
}

describe("warmup-account процессор", () => {
  it("первый запуск фиксирует старт и выполняет сессию дня 1", async () => {
    const repo = new InMemoryWarmupRepository();
    await repo.save({ accountId: ACC as SocialAccountId, platform: "instagram", warmupStage: 0 });
    const proc = createWarmupProcessor({ warmupRepo: repo, logger: silent, now: () => new Date("2026-01-01T00:00:00Z") });
    const res = await proc(fakeJob({ orgId: ORG, accountId: ACC }));
    expect(res.day).toBe(1);
    expect(res.stage).toBe(1);
    expect(res.actions).toBeGreaterThan(0);
    expect(res.warmedUp).toBe(false);
    expect((await repo.get(ACC as SocialAccountId))?.warmupStartedAt).toBeDefined();
  });

  it("эскалация: на 14-й день аккаунт становится прогретым", async () => {
    const repo = new InMemoryWarmupRepository();
    await repo.save({
      accountId: ACC as SocialAccountId,
      platform: "instagram",
      warmupStartedAt: new Date("2026-01-01T00:00:00Z"),
      warmupStage: 13,
    });
    const proc = createWarmupProcessor({ warmupRepo: repo, logger: silent, now: () => new Date("2026-01-14T00:00:00Z") });
    const res = await proc(fakeJob({ orgId: ORG, accountId: ACC }));
    expect(res.day).toBe(WARMUP_TOTAL_DAYS);
    expect(res.warmedUp).toBe(true);
  });

  it("неизвестный аккаунт отклоняется", async () => {
    const repo = new InMemoryWarmupRepository();
    const proc = createWarmupProcessor({ warmupRepo: repo, logger: silent });
    await expect(proc(fakeJob({ orgId: ORG, accountId: ACC }))).rejects.toThrow(/не найден/);
  });
});
