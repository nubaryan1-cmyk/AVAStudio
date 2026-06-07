import { describe, expect, it } from "vitest";

import { buildOnboardingResult } from "../../lib/onboarding.js";
import { createCaller } from "../routers/_app.js";

/**
 * TASK 14.1 — Сквозной E2E (in-process, через createCaller):
 * регистрация → медиа → рендер уникальных вариантов → планирование «постинга» в mock.
 * Проверяет корректность всей цепочки без внешних подключений.
 */
describe("E2E: полный путь пользователя", () => {
  const caller = createCaller({});

  it("онбординг → аккаунт (креды шифруются) → медиа → рендер → расписание", async () => {
    // 1. Онбординг
    const onboarding = buildOnboardingResult({
      workspace: { name: "  Моя студия  " },
      account: { platform: "instagram", handle: "@brand" },
      plan: { planId: "pro" },
    });
    expect(onboarding.org.name).toBe("Моя студия");
    expect(onboarding.planId).toBe("pro");
    expect(onboarding.ownerRole).toBe("owner");

    // 2. Дашборд доступен
    const summary = await caller.dashboard.summary();
    expect(summary.accountsCount).toBeGreaterThanOrEqual(0);

    // 3. Подключение аккаунта — секрет шифруется, не хранится в открытом виде
    const secret = "e2e-very-secret-token";
    const account = await caller.accounts.add({
      platform: "tiktok",
      handle: "@e2e.account",
      mechanism: "browser",
      secret,
    });
    expect(account.status).toBe("authorized");
    expect(account.encryptedCreds.v).toBe(1);
    expect(JSON.stringify(account.encryptedCreds)).not.toContain(secret);

    // 4. Загрузка видео в медиатеку
    const asset = await caller.media.upload({
      name: "e2e-source.mp4",
      type: "video",
      sizeBytes: 8_000_000,
      durationSec: 15,
      width: 1080,
      height: 1920,
      fps: 30,
      tags: ["e2e"],
    });
    expect(asset.id).toBeTruthy();
    expect(asset.type).toBe("video");

    // 5. Превью фильтров
    const preview = await caller.editor.preview({
      sourceAssetId: asset.id,
      presetIds: ["mirror", "crop"],
      seed: 42,
    });
    expect(preview).toBeTruthy();

    // 6. Рендер пакета уникальных вариантов
    const batch = await caller.editor.enqueue({
      sourceAssetId: asset.id,
      presetIds: ["mirror"],
      profileIds: ["instagram-reels", "tiktok"],
      variants: 3,
      seed: 7,
    });
    expect(batch.batchId).toBeTruthy();
    expect(batch.jobs.length).toBe(3 * 2); // variants × profiles

    const synced = await caller.editor.batch({ batchId: batch.batchId });
    expect(synced.length).toBe(batch.jobs.length);

    // 7. Планирование «постинга» в mock (с проверкой anti-ban конфликтов)
    const when = new Date(Date.now() + 86_400_000).toISOString();
    const conflicts = await caller.scheduling.conflicts({ accountId: account.id, scheduledAt: when });
    expect(Array.isArray(conflicts)).toBe(true);

    const post = await caller.scheduling.schedule({
      accountId: account.id,
      assetId: asset.id,
      scheduledAt: when,
    });
    expect(post.accountId).toBe(account.id);
    expect(post.assetId).toBe(asset.id);

    // 8. Пост виден в календаре
    const posts = await caller.scheduling.posts();
    expect(posts.some((p) => p.id === post.id)).toBe(true);

    // 9. Биллинг + диагностика аккаунта
    const promo = await caller.billing.applyPromo({ code: "WELCOME10" });
    expect(promo).toBeTruthy();
    const diag = await caller.billing.diagnose({ accountId: account.id });
    expect(diag).not.toBeNull();
  });
});
