import { randomUUID } from "node:crypto";

import type { ProxyProvider, ProxyProviderCapabilities, ProxySession, ProxySpec } from "../types.js";

/**
 * Реальный драйвер IPRoyal residential (TASK 22.3) — второй провайдер прокси,
 * взаимозаменяемый с Bright Data (тот же ProxyProvider). Sticky кодируется в password
 * (`_session-<id>_lifetime-...`, конвенция IPRoyal). Креды — из Doppler.
 */
export interface IPRoyalConfig {
  username?: string;
  password?: string;
  host?: string;
  port?: number;
  fetchImpl?: typeof fetch;
  healthUrl?: string;
}

const CAPS: ProxyProviderCapabilities = { sticky: true, residential: true, protocols: ["http", "https", "socks5"] };

export function createIPRoyalProvider(config: IPRoyalConfig = {}): ProxyProvider {
  const host = config.host ?? "geo.iproyal.com";
  const port = config.port ?? 12321;
  function ensure(): { username: string; password: string } {
    if (!config.username || !config.password) {
      throw new Error("iproyal: креды не настроены");
    }
    return { username: config.username, password: config.password };
  }
  return {
    name: "iproyal",
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
      // IPRoyal: sticky + гео кодируются в password.
      const geo = spec.region ? `_country-${spec.region.toLowerCase()}` : "";
      const stickyPass = `${password}${geo}_session-${sessionId}_lifetime-30m`;
      const endpoint = {
        host,
        port,
        protocol: spec.protocol,
        ...(spec.region ? { region: spec.region } : {}),
      };
      return Promise.resolve({
        sessionId,
        endpoint,
        credentials: { username, password: stickyPass },
      });
    },
    release(_sessionId: string): Promise<void> {
      return Promise.resolve();
    },
  };
}
