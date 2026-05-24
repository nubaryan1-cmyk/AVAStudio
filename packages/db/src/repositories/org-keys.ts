import {
  CURRENT_KEY_VERSION,
  generateDataKey,
  unwrapDataKey,
  wrapDataKey,
  env,
} from "@avastudio/shared";
import { eq } from "drizzle-orm";

import { organizationDataKeys } from "../schema/index.js";

import type { Db } from "./types.js";

/** KEK из окружения (по умолчанию). В тестах передаётся явно. */
export function envKek(): Uint8Array {
  return new Uint8Array(Buffer.from(env.CREDENTIALS_ENCRYPTION_KEY, "base64"));
}

/**
 * Возвращает расшифрованный DEK организации, создавая и сохраняя обёрнутый DEK при отсутствии.
 * ТОЛЬКО server/service-контекст. DEK не сохранять дольше необходимого.
 */
export async function getOrCreateOrgDataKey(
  db: Db,
  orgId: string,
  kek: Uint8Array = envKek(),
): Promise<Uint8Array> {
  const existing = await db
    .select({ wrappedDek: organizationDataKeys.wrappedDek })
    .from(organizationDataKeys)
    .where(eq(organizationDataKeys.orgId, orgId))
    .limit(1);

  const found = existing[0];
  if (found) {
    return unwrapDataKey(found.wrappedDek, kek);
  }

  const dek = generateDataKey();
  await db.insert(organizationDataKeys).values({
    orgId,
    wrappedDek: wrapDataKey(dek, kek),
    keyVersion: CURRENT_KEY_VERSION,
  });
  return dek;
}
