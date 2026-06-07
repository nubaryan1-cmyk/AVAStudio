/**
 * Общие хелперы драйверов соцплатформ (TASK 12.4). Драйверы провайдеро-независимы и
 * получают зависимости (ProxyManager, PhonePool) через DriverContext — это позволяет
 * подменять mock на реальные в Фазе 2 без изменения кода платформ.
 */
import { randomUUID } from "node:crypto";

import type { Platform } from "../../domain/enums.js";
import type { OrgId } from "../../domain/ids.js";
import type { PhonePool } from "../../phones/index.js";
import type { ProxyManager } from "../../proxies/index.js";
import type {
  AccountStats,
  ImplMechanism,
  MediaRef,
  PlatformCapabilities,
  PostOptions,
  PostResult,
  Session,
  SocialAccountRef,
  SocialPlatform,
} from "../types.js";

/**
 * Зависимости драйвера. Все опциональны: в чистых unit-тестах драйвер работает как
 * mock; при наличии proxyManager/phonePool — задействует sticky-прокси и (для phone)
 * аренду устройства, как будет в Фазе 2.
 */
export interface DriverContext {
  proxyManager?: ProxyManager;
  phonePool?: PhonePool;
  /** Нужны для assign прокси (шифрование кредов DEK организации). */
  orgId?: OrgId;
  dek?: Uint8Array;
  /** Принудительный сбой публикаций (для тестов). */
  failPosts?: boolean;
}

/**
 * Выбор механизма: явное предпочтение опций → если поддерживается; иначе основной
 * (первый в capabilities.mechanisms). Бросает, если механизм не поддержан платформой.
 */
export function chooseMechanism(
  capabilities: PlatformCapabilities,
  opts: PostOptions | undefined,
  sessionMechanism?: ImplMechanism,
): ImplMechanism {
  const preferred = opts?.preferMechanism ?? sessionMechanism;
  if (preferred !== undefined) {
    if (!capabilities.mechanisms.includes(preferred)) {
      throw new Error(`механизм ${preferred} не поддерживается платформой`);
    }
    return preferred;
  }
  const primary = capabilities.mechanisms[0];
  if (primary === undefined) {
    throw new Error("у платформы не задан ни один механизм");
  }
  return primary;
}

export interface MockDriverConfig {
  platform: Platform;
  capabilities: PlatformCapabilities;
  ctx?: DriverContext;
}

/**
 * Базовая mock-реализация SocialPlatform для конкретной платформы. На login —
 * при наличии контекста назначает sticky-прокси (ProxyManager) и, если основной
 * механизм phone и есть PhonePool, арендует устройство. Публикации детерминированы.
 */
export function createMockSocialDriver(config: MockDriverConfig): SocialPlatform {
  const { platform, capabilities } = config;
  const ctx = config.ctx ?? {};
  const primaryMechanism = capabilities.mechanisms[0] ?? "api";

  async function ensureProxy(account: SocialAccountRef): Promise<string | undefined> {
    if (ctx.proxyManager !== undefined && ctx.orgId !== undefined && ctx.dek !== undefined) {
      const handle = await ctx.proxyManager.assign({
        orgId: ctx.orgId,
        accountId: account.accountId,
        dek: ctx.dek,
      });
      return handle.id;
    }
    return undefined;
  }

  function build(mechanism: ImplMechanism): PostResult {
    if (ctx.failPosts === true) {
      return {
        ok: false,
        platform,
        mechanism,
        error: `${platform}: симулированный сбой публикации`,
        postedAt: new Date(),
      };
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
      const proxyId = await ensureProxy(account);
      let sessionRef = `mock-${platform}-${randomUUID()}`;
      // phone-режим: при наличии пула арендуем устройство (как в Фазе 2).
      if (primaryMechanism === "phone" && ctx.phonePool !== undefined) {
        const lease = await ctx.phonePool.acquire({ label: account.accountId });
        sessionRef = `device:${lease.device.id}`;
      }
      if (proxyId !== undefined) {
        sessionRef = `${sessionRef}|proxy:${proxyId}`;
      }
      return {
        accountId: account.accountId,
        platform,
        mechanism: primaryMechanism,
        sessionRef,
        createdAt: new Date(),
      };
    },
    async postVideo(session: Session, _video: MediaRef, opts?: PostOptions): Promise<PostResult> {
      return build(chooseMechanism(capabilities, opts, session.mechanism));
    },
    async postPhoto(session: Session, _photo: MediaRef, opts?: PostOptions): Promise<PostResult> {
      return build(chooseMechanism(capabilities, opts, session.mechanism));
    },
    async postCarousel(
      session: Session,
      _items: readonly MediaRef[],
      opts?: PostOptions,
    ): Promise<PostResult> {
      return build(chooseMechanism(capabilities, opts, session.mechanism));
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
