import { z } from "zod";

import type { EncryptedBlob } from "../credentials/index.js";
import type { OrgId, ProxyId, SocialAccountId } from "../domain/ids.js";

/**
 * Провайдеро-независимый менеджер прокси (ADR-017, TASK 12.3). КРИТИЧНО: каждому
 * соц-аккаунту — свой sticky residential proxy (стабильный IP/локация), иначе баны.
 * Провайдеры (Bright Data / IPRoyal / Smartproxy) не зашиты жёстко: интерфейс
 * ProxyProvider реализуют ≥1 драйвер, оркестратор ProxyManager делает failover и
 * sticky-привязку per account. Креды прокси ВСЕГДА шифруются (ЭТАП 2). Фаза 1 — mock,
 * реальные провайдеры и reputation-scoring — Фаза 2 (ЭТАП 25).
 */

export const PROXY_PROTOCOLS = ["http", "https", "socks5"] as const;
export type ProxyProtocol = (typeof PROXY_PROTOCOLS)[number];

/** Запрос на выдачу прокси для аккаунта. */
export const proxySpecSchema = z.object({
  /** Гео-таргет (страна/город) — важно для согласования с устройством/аккаунтом. */
  region: z.string().optional(),
  protocol: z.enum(PROXY_PROTOCOLS).default("http"),
});
export type ProxySpec = z.infer<typeof proxySpecSchema>;

/** Сетевой адрес прокси (без секретов). */
export interface ProxyEndpoint {
  host: string;
  port: number;
  protocol: ProxyProtocol;
  region?: string;
}

/**
 * Креды прокси в открытом виде. НИКОГДА не хранить и не логировать — использовать
 * сразу и зашифровать (encryptJSON) перед записью в БД.
 */
export interface ProxyCredentials {
  username: string;
  password: string;
}

/** Sticky-сессия, выданная провайдером: стабильный IP, пока сессия жива. */
export interface ProxySession {
  /** Идентификатор сессии у провайдера (для release/продления). */
  sessionId: string;
  endpoint: ProxyEndpoint;
  credentials: ProxyCredentials;
}

/** Capabilities провайдера прокси. */
export interface ProxyProviderCapabilities {
  /** Поддержка sticky-сессий (стабильный IP на время сессии). */
  sticky: boolean;
  residential: boolean;
  protocols: readonly ProxyProtocol[];
}

/**
 * Интерфейс провайдера прокси. Реальные/mock-драйверы реализуют его поверх своего API.
 */
export interface ProxyProvider {
  readonly name: string;
  readonly capabilities: ProxyProviderCapabilities;
  isHealthy(): Promise<boolean>;
  /** Выдаёт sticky-сессию (стабильный IP) под спецификацию. */
  acquireSticky(spec: ProxySpec): Promise<ProxySession>;
  /** Освобождает сессию у провайдера. */
  release(sessionId: string): Promise<void>;
}

/**
 * Хранимая привязка прокси к аккаунту. Креды зашифрованы (EncryptedBlob); endpoint
 * и метаданные — открыто. Один аккаунт = одна активная запись (sticky).
 */
export interface StoredProxy {
  id: ProxyId;
  orgId: OrgId;
  accountId: SocialAccountId;
  provider: string;
  sessionId: string;
  endpoint: ProxyEndpoint;
  /** Зашифрованные ProxyCredentials (encryptJSON DEK организации). */
  encryptedCredentials: EncryptedBlob;
  /** Заготовка под reputation (ЭТАП 25): счётчики успехов/ошибок. */
  reputation: ProxyReputation;
  active: boolean;
}

/** Репутация прокси — заготовка (полноценный scoring в Фазе 2). */
export interface ProxyReputation {
  success: number;
  fail: number;
}

/** Порт репозитория прокси (адаптер БД — отдельно, ЭТАП 4). */
export interface ProxyRepository {
  findActiveByAccount(accountId: SocialAccountId): Promise<StoredProxy | undefined>;
  findById(id: ProxyId): Promise<StoredProxy | undefined>;
  save(proxy: StoredProxy): Promise<void>;
  /** Помечает запись неактивной (при ротации). */
  deactivate(id: ProxyId): Promise<void>;
}
