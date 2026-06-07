/**
 * Драйвер Instagram (TASK 12.4). Основной механизм — phone (PhonePool/ADB),
 * запасной — browser (Playwright desktop, см. browser-skeleton.ts и
 * docs/legacy/uploader-reference.md). Reels create flow есть только на desktop www,
 * не на mobile web — отсюда browser именно desktop, а основной путь — phone.
 * Фаза 1 — mock; реальные механизмы — Фаза 2.
 */
import { createMockSocialDriver, type DriverContext } from "../shared.js";

import type { PlatformCapabilities, SocialPlatform } from "../../types.js";

export const instagramCapabilities: PlatformCapabilities = {
  video: true,
  photo: true,
  carousel: true,
  stats: true,
  mechanisms: ["phone", "browser"],
};

/** Mock-драйвер Instagram (phone основной, browser запасной). */
export function createInstagramDriver(ctx: DriverContext = {}): SocialPlatform {
  return createMockSocialDriver({ platform: "instagram", capabilities: instagramCapabilities, ctx });
}

export * from "./browser-skeleton.js";
