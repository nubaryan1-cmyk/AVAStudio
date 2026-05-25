import { z } from "zod";

import type { Platform } from "../domain/enums.js";

export interface PlatformRules {
  maxCaptionLength: number;
  video: { maxDurationSec: number; aspectRatios: string[] };
}

/** Требования платформ. Record<Platform,...> гарантирует покрытие всех платформ на этапе компиляции. */
export const PLATFORM_RULES: Record<Platform, PlatformRules> = {
  instagram: {
    maxCaptionLength: 2200,
    video: { maxDurationSec: 90, aspectRatios: ["9:16", "4:5", "1:1"] },
  },
  tiktok: { maxCaptionLength: 2200, video: { maxDurationSec: 180, aspectRatios: ["9:16"] } },
  reddit: {
    maxCaptionLength: 300,
    video: { maxDurationSec: 900, aspectRatios: ["9:16", "16:9", "1:1"] },
  },
  threads: { maxCaptionLength: 500, video: { maxDurationSec: 90, aspectRatios: ["9:16", "1:1"] } },
  youtube: { maxCaptionLength: 5000, video: { maxDurationSec: 60, aspectRatios: ["9:16"] } },
  x: { maxCaptionLength: 280, video: { maxDurationSec: 140, aspectRatios: ["16:9", "1:1"] } },
};

/** Zod-схема подписи с учётом лимита конкретной платформы. */
export function captionSchemaFor(platform: Platform) {
  const max = PLATFORM_RULES[platform].maxCaptionLength;
  return z.string().max(max, `Подпись для ${platform}: максимум ${max} символов`);
}
