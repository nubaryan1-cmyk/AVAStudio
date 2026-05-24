import { decryptJSON, encryptJSON } from "@avastudio/shared";
import { eq } from "drizzle-orm";

import { proxies, proxyProvider as proxyProviderEnum } from "../schema/index.js";

import { envKek, getOrCreateOrgDataKey } from "./org-keys.js";

import type { Db } from "./types.js";

type ProxyProvider = (typeof proxyProviderEnum.enumValues)[number];

export interface ProxyCredentials {
  username?: string;
  password?: string;
}

export interface CreateProxyInput {
  orgId: string;
  provider: ProxyProvider;
  host?: string;
  port?: number;
  stickySessionId?: string;
  credentials?: ProxyCredentials;
}

/** Создаёт прокси, шифруя креды DEK организации. */
export async function createProxy(
  db: Db,
  input: CreateProxyInput,
  kek: Uint8Array = envKek(),
): Promise<{ id: string }> {
  let credentialsEncrypted = null;
  if (input.credentials) {
    const dek = await getOrCreateOrgDataKey(db, input.orgId, kek);
    credentialsEncrypted = encryptJSON(input.credentials, dek);
  }

  const rows = await db
    .insert(proxies)
    .values({
      orgId: input.orgId,
      provider: input.provider,
      host: input.host,
      port: input.port,
      stickySessionId: input.stickySessionId,
      credentialsEncrypted,
    })
    .returning({ id: proxies.id });

  const row = rows[0];
  if (!row) {
    throw new Error("Не удалось создать proxy");
  }
  return row;
}

/** Расшифровывает креды прокси. ТОЛЬКО server/worker-контекст. */
export async function getProxyCredentials(
  db: Db,
  id: string,
  kek: Uint8Array = envKek(),
): Promise<ProxyCredentials | null> {
  const rows = await db
    .select({ orgId: proxies.orgId, enc: proxies.credentialsEncrypted })
    .from(proxies)
    .where(eq(proxies.id, id))
    .limit(1);

  const proxy = rows[0];
  if (!proxy || !proxy.enc) {
    return null;
  }
  const dek = await getOrCreateOrgDataKey(db, proxy.orgId, kek);
  return decryptJSON<ProxyCredentials>(proxy.enc, dek);
}
