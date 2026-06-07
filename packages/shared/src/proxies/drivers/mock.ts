/**
 * Mock-драйвер ProxyProvider (TASK 12.3). Имитирует residential-провайдер sticky-сессий
 * в памяти: каждая сессия — уникальный стабильный IP. Реальные провайдеры
 * (Bright Data / IPRoyal / Smartproxy) — Фаза 2 (ЭТАП 25).
 */
import { randomInt, randomUUID } from "node:crypto";

import type { ProxyProvider, ProxyProviderCapabilities, ProxySession, ProxySpec } from "../types.js";

export interface MockProxyProviderOptions {
  name: string;
  /** Провайдер «лежит» — isHealthy=false, выдача бросает (для failover-теста). */
  down?: boolean;
}

const CAPS: ProxyProviderCapabilities = {
  sticky: true,
  residential: true,
  protocols: ["http", "https", "socks5"],
};

/** Создаёт mock-провайдер прокси с in-memory sticky-сессиями. */
export function createMockProxyProvider(options: MockProxyProviderOptions): ProxyProvider {
  const name = options.name;
  const sessions = new Set<string>();

  return {
    name,
    capabilities: CAPS,
    async isHealthy(): Promise<boolean> {
      return options.down !== true;
    },
    async acquireSticky(spec: ProxySpec): Promise<ProxySession> {
      if (options.down === true) {
        throw new Error(`${name}: провайдер недоступен`);
      }
      const sessionId = randomUUID();
      sessions.add(sessionId);
      // Стабильный «IP» на сессию — детерминированно по sessionId не нужен; mock-октеты.
      const host = `10.${randomInt(0, 256)}.${randomInt(0, 256)}.${randomInt(1, 255)}`;
      return {
        sessionId,
        endpoint: {
          host,
          port: 8000 + randomInt(0, 1000),
          protocol: spec.protocol,
          ...(spec.region !== undefined ? { region: spec.region } : {}),
        },
        credentials: { username: `${name}-${sessionId.slice(0, 8)}`, password: randomUUID() },
      };
    },
    async release(sessionId: string): Promise<void> {
      sessions.delete(sessionId);
    },
  };
}
