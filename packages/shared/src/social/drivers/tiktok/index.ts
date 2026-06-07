/**
 * Драйвер TikTok (TASK 12.4). Основной механизм — phone (PhonePool/ADB нативного
 * приложения), запасной — browser (Playwright). Фаза 1 — mock; реальные — Фаза 2.
 */
import { createMockSocialDriver, type DriverContext } from "../shared.js";

import type { MediaRef, PlatformCapabilities, PostOptions, PostResult, Session, SocialPlatform } from "../../types.js";

export const tiktokCapabilities: PlatformCapabilities = {
  video: true,
  photo: false,
  carousel: false,
  stats: true,
  mechanisms: ["phone", "browser"],
};

/** Mock-драйвер TikTok (phone основной, browser запасной). */
export function createTiktokDriver(ctx: DriverContext = {}): SocialPlatform {
  return createMockSocialDriver({ platform: "tiktok", capabilities: tiktokCapabilities, ctx });
}

/** Каркас реального browser-драйвера TikTok (Playwright). Фаза 2 (ЭТАП 22). */
export async function tiktokBrowserPostVideo(
  _session: Session,
  _video: MediaRef,
  _opts: PostOptions | undefined,
): Promise<PostResult> {
  throw new Error("tiktokBrowserPostVideo: реальный драйвер доступен в Фазе 2 (ЭТАП 22)");
}
