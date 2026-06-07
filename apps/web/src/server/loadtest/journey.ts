import { PLATFORMS } from "@avastudio/shared/domain";

import { buildOnboardingResult } from "../../lib/onboarding.js";
import { createCaller } from "../routers/_app.js";

import type { VuContext } from "./harness.js";

export type Caller = ReturnType<typeof createCaller>;

const MECHANISMS = ["api", "browser", "phone"] as const;
// Только платформы с mock-драйвером в Фазе 1 (registry: ig/tiktok/reddit/threads).
const SUPPORTED_PLATFORMS = ["instagram", "tiktok", "reddit", "threads"] as const;
const PROFILE_IDS = ["instagram-reels", "tiktok", "reddit"] as const;
const PROMO_CODES = ["WELCOME10", "LAUNCH50", "INVALID", "BLACKFRIDAY"] as const;

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

/**
 * Полный пользовательский путь по всему функционалу AVAStudio.
 * Параметр `writeFraction` ограничивает долю VU, выполняющих запись
 * (add/upload/enqueue/schedule), чтобы in-memory сторы не росли безгранично
 * при 1M пользователей. Чтение (дашборд/списки/превью/диагностика) — всегда.
 */
export async function userJourney(
  caller: Caller,
  ctx: VuContext,
  writeFraction: number,
): Promise<void> {
  const { rng, step } = ctx;
  const doWrite = rng() < writeFraction;

  // 1. Онбординг (чистая доменная логика)
  await step("onboarding", () =>
    buildOnboardingResult({
      workspace: { name: `ws-${ctx.index}` },
      account: { platform: pick(rng, PLATFORMS), handle: `@u${ctx.index}` },
      plan: { planId: pick(rng, ["starter", "pro", "studio"] as const) },
    }),
  );

  // 2. Дашборд (агрегаты)
  await step("dashboard.summary", () => caller.dashboard.summary());

  // 3. Аккаунты: список + фильтр + деталь
  const accounts = await step("accounts.list", () =>
    caller.accounts.list(rng() < 0.5 ? {} : { platform: pick(rng, PLATFORMS) }),
  );
  if (accounts.length > 0) {
    const target = accounts[Math.floor(rng() * accounts.length)]!;
    await step("accounts.byId", () => caller.accounts.byId({ id: target.id }));
  }

  // 4. Медиатека: список + теги
  await step("media.list", () => caller.media.list({ type: "video" }));
  await step("media.allTags", () => caller.media.allTags());

  // 5. Биллинг + диагностика
  await step("billing.state", () => caller.billing.state());
  await step("billing.applyPromo", () => caller.billing.applyPromo({ code: pick(rng, PROMO_CODES) }));
  if (accounts.length > 0) {
    const acc = accounts[Math.floor(rng() * accounts.length)]!;
    await step("billing.diagnose", () => caller.billing.diagnose({ accountId: acc.id }));
  }

  // 6. Календарь: расписуемые аккаунты + проверка конфликтов
  const schedAccounts = await step("scheduling.accounts", () => caller.scheduling.accounts());
  await step("scheduling.posts", () => caller.scheduling.posts());

  // 7. Редактор: пресеты/профили/превью
  const videos = await step("media.listVideos", () => caller.media.list({ type: "video" }));
  if (videos.length > 0) {
    const src = videos[Math.floor(rng() * videos.length)]!;
    await step("editor.preview", () =>
      caller.editor.preview({ sourceAssetId: src.id, presetIds: ["mirror", "crop"], seed: ctx.index }),
    );

    // --- Пути записи (сэмплируются) ---
    if (doWrite) {
      const acc = await step("accounts.add", () =>
        caller.accounts.add({
          platform: pick(rng, SUPPORTED_PLATFORMS),
          handle: `@load.${ctx.index}`,
          mechanism: pick(rng, MECHANISMS),
          secret: `s3cr3t-${ctx.index}`,
        }),
      );

      const asset = await step("media.upload", () =>
        caller.media.upload({
          name: `load-${ctx.index}.mp4`,
          type: "video",
          sizeBytes: 5_000_000,
          durationSec: 12,
          width: 1080,
          height: 1920,
          fps: 30,
          tags: ["loadtest"],
        }),
      );

      const batch = await step("editor.enqueue", () =>
        caller.editor.enqueue({
          sourceAssetId: asset.id,
          presetIds: ["mirror"],
          profileIds: [pick(rng, PROFILE_IDS)],
          variants: 2,
          seed: ctx.index,
        }),
      );
      await step("editor.batch", () => caller.editor.batch({ batchId: batch.batchId }));

      const when = new Date(Date.now() + 86_400_000 + ctx.index * 1000).toISOString();
      await step("scheduling.conflicts", () =>
        caller.scheduling.conflicts({ accountId: acc.id, scheduledAt: when }),
      );
      await step("scheduling.schedule", () =>
        caller.scheduling.schedule({ accountId: acc.id, assetId: asset.id, scheduledAt: when }),
      );
    }
  }
  void schedAccounts;
}
