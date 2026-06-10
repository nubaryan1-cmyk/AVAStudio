import { decryptJSON, encryptJSON } from "@avastudio/shared";
import { and, eq } from "drizzle-orm";

import { organizations, platform as platformEnum, socialAccounts } from "../schema/index.js";

import { envKek, getOrCreateOrgDataKey } from "./org-keys.js";

import type { Db } from "./types.js";

type Platform = (typeof platformEnum.enumValues)[number];

export interface SocialAccountCredentials {
  password?: string;
  accessToken?: string;
  refreshToken?: string;
  cookies?: { name: string; value: string }[];
}

export interface CreateSocialAccountInput {
  orgId: string;
  platform: Platform;
  username: string;
  credentials?: SocialAccountCredentials;
}

/** Создаёт аккаунт, шифруя креды DEK организации (envelope). */
export async function createSocialAccount(
  db: Db,
  input: CreateSocialAccountInput,
  kek: Uint8Array = envKek(),
): Promise<{ id: string }> {
  let credentialsEncrypted = null;
  if (input.credentials) {
    const dek = await getOrCreateOrgDataKey(db, input.orgId, kek);
    credentialsEncrypted = encryptJSON(input.credentials, dek);
  }

  const rows = await db
    .insert(socialAccounts)
    .values({
      orgId: input.orgId,
      platform: input.platform,
      username: input.username,
      credentialsEncrypted,
    })
    .returning({ id: socialAccounts.id });

  const row = rows[0];
  if (!row) {
    throw new Error("Не удалось создать social_account");
  }
  return row;
}

/** Расшифровывает креды аккаунта. ТОЛЬКО server/worker-контекст — НЕ вызывать из UI. */
export async function getSocialAccountCredentials(
  db: Db,
  id: string,
  kek: Uint8Array = envKek(),
): Promise<SocialAccountCredentials | null> {
  const rows = await db
    .select({ orgId: socialAccounts.orgId, enc: socialAccounts.credentialsEncrypted })
    .from(socialAccounts)
    .where(eq(socialAccounts.id, id))
    .limit(1);

  const account = rows[0];
  if (!account || !account.enc) {
    return null;
  }
  const dek = await getOrCreateOrgDataKey(db, account.orgId, kek);
  return decryptJSON<SocialAccountCredentials>(account.enc, dek);
}

/** Список аккаунтов для UI — БЕЗ зашифрованных кредов (явный whitelist полей). */
export async function listSocialAccountsForUi(db: Db, orgId: string) {
  return db
    .select({
      id: socialAccounts.id,
      platform: socialAccounts.platform,
      username: socialAccounts.username,
      status: socialAccounts.status,
      healthScore: socialAccounts.healthScore,
    })
    .from(socialAccounts)
    .where(eq(socialAccounts.orgId, orgId));
}


/** Находит/создаёт дефолт-организацию (single-tenant на тест-фазе). Возвращает её id. */
export async function getOrCreateDefaultOrg(db: Db): Promise<string> {
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, "default"))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const created = await db
    .insert(organizations)
    .values({ name: "AVAStudio", slug: "default" })
    .returning({ id: organizations.id });
  const row = created[0];
  if (!row) throw new Error("Не удалось создать организацию");
  return row.id;
}


/** Удаляет аккаунт по id (в рамках организации). */
export async function deleteSocialAccount(db: Db, orgId: string, id: string): Promise<void> {
  await db.delete(socialAccounts).where(and(eq(socialAccounts.orgId, orgId), eq(socialAccounts.id, id)));
}
