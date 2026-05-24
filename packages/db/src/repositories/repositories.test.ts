import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { generateDataKey } from "@avastudio/shared";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";

import * as schema from "../schema/index.js";

import {
  createSocialAccount,
  getSocialAccountCredentials,
  listSocialAccountsForUi,
} from "./social-accounts.js";

const migDir = fileURLToPath(new URL("../../migrations/", import.meta.url));
const ORG_ID = "00000000-0000-4000-8000-0000000000c0";
const KEK = generateDataKey(); // тестовый KEK (32 байта)

let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  client = new PGlite();
  await client.exec(readFileSync(`${migDir}0000_fast_spiral.sql`, "utf8"));
  await client.exec(readFileSync(`${migDir}0001_rls.sql`, "utf8"));
  db = drizzle(client, { schema });
  await client.exec(`INSERT INTO organizations (id, name, slug) VALUES ('${ORG_ID}','C','c');`);
});

describe("social-accounts repository (envelope encryption)", () => {
  it("шифрует креды: в колонке шифртекст, а расшифровка возвращает исходник", async () => {
    const { id } = await createSocialAccount(
      db,
      {
        orgId: ORG_ID,
        platform: "instagram",
        username: "secret_acc",
        credentials: { password: "TOP_SECRET_PWD", cookies: [{ name: "sid", value: "abc" }] },
      },
      KEK,
    );

    // raw-колонка не содержит plaintext
    const raw = await client.query<{ credentials_encrypted: unknown }>(
      `SELECT credentials_encrypted FROM social_accounts WHERE id = '${id}'`,
    );
    const blobJson = JSON.stringify(raw.rows[0]!.credentials_encrypted);
    expect(blobJson).not.toContain("TOP_SECRET_PWD");
    expect(blobJson).toContain("ct"); // EncryptedBlob.ct присутствует

    // расшифровка через серверный метод
    const creds = await getSocialAccountCredentials(db, id, KEK);
    expect(creds?.password).toBe("TOP_SECRET_PWD");
    expect(creds?.cookies?.[0]?.value).toBe("abc");
  });

  it("UI-список не отдаёт зашифрованные креды", async () => {
    const list = await listSocialAccountsForUi(db, ORG_ID);
    expect(list.length).toBeGreaterThan(0);
    for (const row of list) {
      expect(Object.keys(row)).not.toContain("credentialsEncrypted");
    }
  });

  it("аккаунт без кредов → расшифровка возвращает null", async () => {
    const { id } = await createSocialAccount(
      db,
      { orgId: ORG_ID, platform: "reddit", username: "no_creds" },
      KEK,
    );
    expect(await getSocialAccountCredentials(db, id, KEK)).toBeNull();
  });
});
