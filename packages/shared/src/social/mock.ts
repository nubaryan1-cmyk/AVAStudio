/**
 * Mock-драйвер SocialPlatform (Фаза 1, TASK 12.1) — для тестов абстракции и реестра
 * до появления реальных драйверов платформ (12.4). Детерминированный, без сети.
 */
import { randomUUID } from "node:crypto";

import type {
  AccountStats,
  MediaRef,
  PlatformCapabilities,
  PostOptions,
  PostResult,
  Session,
  SocialAccountRef,
  SocialPlatform,
} from "./types.js";
import type { Platform } from "../domain/enums.js";

export interface MockPlatformOptions {
  platform?: Platform;
  capabilities?: Partial<PlatformCapabilities>;
  /** Принудительный сбой публикаций. */
  failPosts?: boolean;
}

const DEFAULT_CAPS: PlatformCapabilities = {
  video: true,
  photo: true,
  carousel: true,
  stats: true,
  mechanisms: ["api"],
};

/** Создаёт mock-драйвер соцплатформы. */
export function createMockPlatform(options: MockPlatformOptions = {}): SocialPlatform {
  const platform: Platform = options.platform ?? "instagram";
  const capabilities: PlatformCapabilities = { ...DEFAULT_CAPS, ...options.capabilities };
  const primaryMechanism = capabilities.mechanisms[0] ?? "api";

  function post(session: Session, opts: PostOptions | undefined): PostResult {
    const mechanism = opts?.preferMechanism ?? session.mechanism;
    if (options.failPosts === true) {
      return { ok: false, platform, mechanism, error: `${platform}: симулированный сбой публикации`, postedAt: new Date() };
    }
    const externalPostId = randomUUID();
    return {
      ok: true,
      platform,
      externalPostId,
      url: `mock://${platform}/p/${externalPostId}`,
      mechanism,
      postedAt: new Date(),
    };
  }

  return {
    platform,
    capabilities,
    async login(account: SocialAccountRef): Promise<Session> {
      return {
        accountId: account.accountId,
        platform,
        mechanism: primaryMechanism,
        sessionRef: `mock-session-${randomUUID()}`,
        createdAt: new Date(),
      };
    },
    async postVideo(session: Session, _video: MediaRef, opts?: PostOptions): Promise<PostResult> {
      return post(session, opts);
    },
    async postPhoto(session: Session, _photo: MediaRef, opts?: PostOptions): Promise<PostResult> {
      return post(session, opts);
    },
    async postCarousel(session: Session, _items: readonly MediaRef[], opts?: PostOptions): Promise<PostResult> {
      return post(session, opts);
    },
    async getStats(account: SocialAccountRef): Promise<AccountStats> {
      return {
        accountId: account.accountId,
        platform,
        followers: 1000,
        following: 200,
        posts: 42,
        avgReach: 500,
        fetchedAt: new Date(),
      };
    },
  };
}
