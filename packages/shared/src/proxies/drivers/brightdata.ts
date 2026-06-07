import { randomUUID } from "node:crypto";

import type { ProxyProvider, ProxyProviderCapabilities, ProxySession, ProxySpec } from "../types.js";

/**
 * Реальный драйвер Bright Data residential (TASK 22.3). Реализует ProxyProvider
 * (ЭТАП 12.3) — ProxyManager не меняется. Sticky-сессия кодируется в username
 * (`-session-<id>`), стабильный IP держится, пока сессия жива. Креды — из Doppler,
 * наружу/в логи не уходят (ProxyManager шифрует их перед записью).
 */
export interface BrightDataConfig {
  /** Customer/zone username, напр. brd-customer-XXXX-zone-residential. */
  username?: string;
  password?: string;
  /** Gateway host:port (по умолчанию официальный residential-gateway). */
  host?: string;
  port?: number;
  /** Проверка здоровья (опц.) — fetch к статус-эндпоинту. */
  fetchImpl?: typeof fetch;
  healthUrl?: string;
}

const CAPS: ProxyProviderCapabilities = { sticky: true, residential: true, protocols: ["http", "https"] };

export function createBrightDataProvider(config: BrightDataConfig = {}): ProxyProvider {
  const host = config.host ?? "brd.superproxy.io";
  const port = config.port ?? 22225;
  function ensure(): { username: string; password: string } {
    if (!config.username || !config.password) {
      throw new Error("brightdata: креды не настроены");
    }
    return { username: config.username, password: config.password };
  }
  return {
    name: "brightdata",
    capabilities: CAPS,
    async isHealthy(): Promise<boolean> {
      if (!config.username || !config.password) return false;
      if (!config.fetchImpl || !config.healthUrl) return true;
      try {
        const res = await config.fetchImpl(config.healthUrl);
        return res.ok;
      } catch {
        return false;
      }
    },
    acquireSticky(spec: ProxySpec): Promise<ProxySession> {
      const { username, password } = ensure();
      const sessionId = randomUUID().slice(0, 12);
      // Sticky + гео кодируются в username (конвенция Bright Data).
      const country = spec.region ? `-country-${spec.region.toLowerCase()}` : "";
      const stickyUser = `${username}${country}-session-${sessionId}`;
      const endpoint = {
        host,
        port,
        protocol: spec.protocol,
        ...(spec.region ? { region: spec.region } : {}),
      };
      return Promise.resolve({
        sessionId,
        endpoint,
        credentials: { username: stickyUser, password },
      });
    },
    release(_sessionId: string): Promise<void> {
      // Residential gateway: сессия истекает сама по TTL — явный release не требуется.
      return Promise.resolve();
    },
  };
}
