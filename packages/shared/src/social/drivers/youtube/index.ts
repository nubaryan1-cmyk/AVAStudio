/**
 * Драйвер YouTube (TASK 20.2). Механизм — официальный YouTube Data API v3 (OAuth2).
 * Фаза 1 — mock; реальная публикация (videos.insert) — каркас ниже, активируется в Фазе 2
 * с access_token из зашифрованного хранилища (ЭТАП 2/3). OAuth-флоу подключения канала —
 * в ../../oauth/google.ts + web-роуты.
 */
import { createMockSocialDriver, type DriverContext } from "../shared.js";

import type {
  MediaRef,
  PlatformCapabilities,
  PostOptions,
  PostResult,
  Session,
  SocialPlatform,
} from "../../types.js";

export const youtubeCapabilities: PlatformCapabilities = {
  video: true,
  photo: false,
  carousel: false,
  stats: true,
  mechanisms: ["api"],
};

/** Mock-драйвер YouTube (для Фазы 1 / тестов / fallback). */
export function createYoutubeDriver(ctx: DriverContext = {}): SocialPlatform {
  return createMockSocialDriver({ platform: "youtube", capabilities: youtubeCapabilities, ctx });
}

export interface YoutubeApiConfig {
  /** OAuth2 access token (Фаза 2 — расшифровка из хранилища кредов). */
  accessToken?: string;
  /** Категория/приватность по умолчанию. */
  privacyStatus?: "public" | "unlisted" | "private";
}

/** Каркас реальной публикации видео на YouTube (videos.insert). Активация — Фаза 2. */
export async function youtubeApiPostVideo(
  _session: Session,
  _video: MediaRef,
  _opts: PostOptions | undefined,
  config: YoutubeApiConfig,
): Promise<PostResult> {
  if (config.accessToken === undefined) {
    throw new Error("youtubeApiPostVideo: нужен OAuth2 access token (Фаза 2)");
  }
  throw new Error("youtubeApiPostVideo: реальный API-драйвер доступен в Фазе 2");
}
