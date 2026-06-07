/**
 * Драйвер Reddit (TASK 12.4). Механизм — официальный API (OAuth2, submit endpoint).
 * Фаза 1 — mock; каркас реального API-драйвера ниже бросает без токена. Фаза 2 — ЭТАП 22.
 */
import { createMockSocialDriver, type DriverContext } from "../shared.js";

import type { MediaRef, PlatformCapabilities, PostOptions, PostResult, Session, SocialPlatform } from "../../types.js";

export const redditCapabilities: PlatformCapabilities = {
  video: true,
  photo: true,
  carousel: false,
  stats: true,
  mechanisms: ["api"],
};

/** Mock-драйвер Reddit (официальный API). */
export function createRedditDriver(ctx: DriverContext = {}): SocialPlatform {
  return createMockSocialDriver({ platform: "reddit", capabilities: redditCapabilities, ctx });
}

export interface RedditApiConfig {
  /** OAuth2 access token (Фаза 2 — из хранилища кредов, расшифровка ProxyManager/Auth). */
  accessToken?: string;
  /** Сабреддит для публикации. */
  subreddit?: string;
}

/** Каркас реального API-драйвера Reddit (OAuth2 /api/submit). Фаза 2. */
export async function redditApiPostVideo(
  _session: Session,
  _video: MediaRef,
  _opts: PostOptions | undefined,
  config: RedditApiConfig,
): Promise<PostResult> {
  if (config.accessToken === undefined) {
    throw new Error("redditApiPostVideo: нужен OAuth2 access token (Фаза 2, ЭТАП 22)");
  }
  throw new Error("redditApiPostVideo: реальный API-драйвер доступен в Фазе 2 (ЭТАП 22)");
}
