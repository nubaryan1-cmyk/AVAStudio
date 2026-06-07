import type { ProxyRepository, StoredProxy } from "./types.js";
import type { ProxyId, SocialAccountId } from "../domain/ids.js";

/**
 * In-memory реализация ProxyRepository для Фазы 1/тестов. Хранит активные привязки
 * прокси к аккаунтам. Реальный БД-адаптер — ЭТАП 4, без изменения ProxyManager.
 */
export class InMemoryProxyRepository implements ProxyRepository {
  private readonly byId = new Map<string, StoredProxy>();

  async findActiveByAccount(accountId: SocialAccountId): Promise<StoredProxy | undefined> {
    for (const proxy of this.byId.values()) {
      if (proxy.accountId === accountId && proxy.active) {
        return proxy;
      }
    }
    return undefined;
  }

  async findById(id: ProxyId): Promise<StoredProxy | undefined> {
    return this.byId.get(id);
  }

  async save(proxy: StoredProxy): Promise<void> {
    this.byId.set(proxy.id, proxy);
  }

  async deactivate(id: ProxyId): Promise<void> {
    const proxy = this.byId.get(id);
    if (proxy !== undefined) {
      this.byId.set(id, { ...proxy, active: false });
    }
  }

  /** Кол-во активных привязок (для тестов/диагностики). */
  get activeCount(): number {
    let n = 0;
    for (const proxy of this.byId.values()) {
      if (proxy.active) {
        n += 1;
      }
    }
    return n;
  }
}
