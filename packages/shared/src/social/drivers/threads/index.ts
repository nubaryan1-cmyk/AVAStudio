/**
 * Драйвер Threads (TASK 12.4). Механизм — Meta Graph API (Threads API). Фаза 1 — mock;
 * каркас реального API-драйвера ниже бросает без токена. Фаза 2 — ЭТАП 22.
 */
import { createMockSocialDriver, type DriverContext } from "../shared.js";

import type { MediaRef, PlatformCapabilities, PostOptions, PostResult, Session, SocialPlatform } from "../../types.js";

export const threadsCapabilities: PlatformCapabilities = {
  video: true,
  photo: true,
  carousel: true,
  stats: true,
  mechanisms: ["api"],
};

/** Mock-драйвер Threads (Meta Graph API). */
export function createThreadsDriver(ctx: DriverContext = {}): SocialPlatform {
  return createMockSocialDriver({ platform: "threads", capabilities: threadsCapabilities, ctx });
}

export interface ThreadsApiConfig {
  /** Long-lived access token Meta Graph (Фаза 2 — из хранилища кредов). */
  accessToken?: string;
  /** Threads user id. */
  userId?: string;
}

/** Каркас реального API-драйвера Threads (Graph API two-step publish). Фаза 2. */
export async function threadsApiPostVideo(
  _session: Session,
  _video: MediaRef,
  _opts: PostOptions | undefined,
  config: ThreadsApiConfig,
): Promise<PostResult> {
  if (config.accessToken === undefined) {
    throw new Error("threadsApiPostVideo: нужен Meta Graph access token (Фаза 2, ЭТАП 22)");
  }
  throw new Error("threadsApiPostVideo: реальный API-драйвер доступен в Фазе 2 (ЭТАП 22)");
}
