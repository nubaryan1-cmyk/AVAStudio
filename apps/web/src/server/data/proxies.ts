import { randomBytes } from "node:crypto";

import { asOrgId, asSocialAccountId } from "@avastudio/shared/domain";
import {
  createMockProxyProvider,
  InMemoryProxyRepository,
  ProxyManager,
} from "@avastudio/shared/proxies";

import { listAccounts } from "./accounts.js";

import type { Platform } from "@avastudio/shared/domain";

/**
 * Прокси-Пул (Фаза 1) — UI-обвязка над ProxyManager (ЭТАП 12.3).
 * Два mock-провайдера (primary + backup для failover), in-memory repo, dev-DEK.
 * Sticky per account; креды шифруются внутри менеджера и наружу не выходят.
 */

const ORG_ID = asOrgId("org_demo");
// Dev-DEK только для Фазы 1 (шифрование кредов прокси в памяти). В Фазе 2 — DEK организации.
const DEK = new Uint8Array(randomBytes(32));

interface ProxyState {
  manager: ProxyManager;
  repo: InMemoryProxyRepository;
}

function getState(): ProxyState {
  const g = globalThis as unknown as { __avsProxy?: ProxyState };
  if (!g.__avsProxy) {
    const repo = new InMemoryProxyRepository();
    const manager = new ProxyManager(
      [createMockProxyProvider({ name: "residential-primary" }), createMockProxyProvider({ name: "residential-backup" })],
      repo,
    );
    g.__avsProxy = { manager, repo };
  }
  return g.__avsProxy;
}

export interface ProxyPoolRow {
  accountId: string;
  handle: string;
  platform: Platform;
  assigned: boolean;
  proxyId: string | null;
  provider: string | null;
  endpoint: string | null;
  reputation: { success: number; fail: number } | null;
}

export async function listProxyPool(): Promise<ProxyPoolRow[]> {
  const { repo } = getState();
  const rows: ProxyPoolRow[] = [];
  for (const acc of listAccounts()) {
    const proxy = await repo.findActiveByAccount(asSocialAccountId(acc.id));
    rows.push({
      accountId: acc.id,
      handle: acc.handle,
      platform: acc.platform,
      assigned: proxy !== undefined,
      proxyId: proxy?.id ?? null,
      provider: proxy?.provider ?? null,
      endpoint: proxy ? `${proxy.endpoint.host}:${proxy.endpoint.port}` : null,
      reputation: proxy?.reputation ?? null,
    });
  }
  return rows;
}

export async function assignProxy(accountId: string): Promise<ProxyPoolRow> {
  const { manager } = getState();
  await manager.assign({ orgId: ORG_ID, accountId: asSocialAccountId(accountId), dek: DEK });
  return rowFor(accountId);
}

export async function rotateProxy(accountId: string): Promise<ProxyPoolRow> {
  const { manager } = getState();
  await manager.rotate({ orgId: ORG_ID, accountId: asSocialAccountId(accountId), dek: DEK });
  return rowFor(accountId);
}

async function rowFor(accountId: string): Promise<ProxyPoolRow> {
  const rows = await listProxyPool();
  const row = rows.find((r) => r.accountId === accountId);
  if (!row) throw new Error("Аккаунт не найден");
  return row;
}
