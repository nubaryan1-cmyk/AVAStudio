import { randomUUID } from "node:crypto";

import { encryptJSON } from "../credentials/index.js";
import { asProxyId } from "../domain/ids.js";

import type {
  ProxyEndpoint,
  ProxyProvider,
  ProxyRepository,
  ProxySpec,
  StoredProxy,
} from "./types.js";
import type { OrgId, ProxyId, SocialAccountId } from "../domain/ids.js";

/** Параметры назначения прокси аккаунту. */
export interface AssignInput {
  orgId: OrgId;
  accountId: SocialAccountId;
  /** DEK организации для шифрования кредов (ЭТАП 2). */
  dek: Uint8Array;
  spec?: ProxySpec;
}

/** Открытый дескриптор прокси (без секретов) для вызывающего кода. */
export interface ProxyHandle {
  id: ProxyId;
  provider: string;
  endpoint: ProxyEndpoint;
}

/**
 * Оркестратор ProxyManager (TASK 12.3). Поверх упорядоченного списка провайдеров:
 * - sticky per account: один аккаунт = один стабильный прокси; повторный assign
 *   возвращает уже привязанный (НЕ меняем IP «горячему» аккаунту).
 * - failover: если первый провайдер недоступен — переход к следующему.
 * - креды шифруются (encryptJSON) перед сохранением; в памяти/логах не задерживаются.
 * - reputation: success/fail per proxy (заготовка, scoring — Фаза 2).
 */
export class ProxyManager {
  private readonly providers: readonly ProxyProvider[];
  private readonly repo: ProxyRepository;

  constructor(providers: readonly ProxyProvider[], repo: ProxyRepository) {
    if (providers.length === 0) {
      throw new RangeError("ProxyManager: нужен минимум один провайдер");
    }
    this.providers = providers;
    this.repo = repo;
  }

  /**
   * Возвращает sticky-прокси аккаунта. Если привязка уже есть — отдаёт её (стабильный
   * IP). Иначе выбирает провайдера (failover), выдаёт sticky-сессию, шифрует креды и
   * сохраняет привязку.
   */
  async assign(input: AssignInput): Promise<ProxyHandle> {
    const existing = await this.repo.findActiveByAccount(input.accountId);
    if (existing !== undefined) {
      return { id: existing.id, provider: existing.provider, endpoint: existing.endpoint };
    }
    const spec: ProxySpec = input.spec ?? { protocol: "http" };
    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        if (!(await provider.isHealthy())) {
          errors.push(`${provider.name}: unhealthy`);
          continue;
        }
        const session = await provider.acquireSticky(spec);
        const stored: StoredProxy = {
          id: asProxyId(randomUUID()),
          orgId: input.orgId,
          accountId: input.accountId,
          provider: provider.name,
          sessionId: session.sessionId,
          endpoint: session.endpoint,
          encryptedCredentials: encryptJSON(session.credentials, input.dek),
          reputation: { success: 0, fail: 0 },
          active: true,
        };
        await this.repo.save(stored);
        return { id: stored.id, provider: stored.provider, endpoint: stored.endpoint };
      } catch (err) {
        errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    throw new Error(`ProxyManager: нет доступных провайдеров (${errors.join("; ")})`);
  }

  /** Текущая привязка аккаунта (без секретов), либо undefined. */
  async getForAccount(accountId: SocialAccountId): Promise<ProxyHandle | undefined> {
    const proxy = await this.repo.findActiveByAccount(accountId);
    if (proxy === undefined) {
      return undefined;
    }
    return { id: proxy.id, provider: proxy.provider, endpoint: proxy.endpoint };
  }

  /**
   * Ротация прокси аккаунта — только по необходимости (бан/деградация). Освобождает
   * старую сессию, деактивирует запись и назначает новую.
   */
  async rotate(input: AssignInput): Promise<ProxyHandle> {
    const existing = await this.repo.findActiveByAccount(input.accountId);
    if (existing !== undefined) {
      const provider = this.providers.find((p) => p.name === existing.provider);
      if (provider !== undefined) {
        await provider.release(existing.sessionId);
      }
      await this.repo.deactivate(existing.id);
    }
    return this.assign(input);
  }

  /** Фиксирует исход использования прокси (заготовка reputation, ЭТАП 25). */
  async recordResult(id: ProxyId, ok: boolean): Promise<void> {
    const proxy = await this.repo.findById(id);
    if (proxy === undefined) {
      return;
    }
    const reputation = {
      success: proxy.reputation.success + (ok ? 1 : 0),
      fail: proxy.reputation.fail + (ok ? 0 : 1),
    };
    await this.repo.save({ ...proxy, reputation });
  }
}
