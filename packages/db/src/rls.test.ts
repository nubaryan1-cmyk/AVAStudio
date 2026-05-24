import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const migDir = fileURLToPath(new URL("../migrations/", import.meta.url));
const ORG_A = "00000000-0000-4000-8000-0000000000a0";
const ORG_B = "00000000-0000-4000-8000-0000000000b0";
const USER_A = "00000000-0000-4000-8000-00000000000a";
const USER_B = "00000000-0000-4000-8000-00000000000b";

let db: PGlite;

async function asUser(uid: string): Promise<void> {
  await db.exec(`SET ROLE avastudio_authenticated; SET app.current_user_id = '${uid}';`);
}
async function asAnon(): Promise<void> {
  await db.exec(`SET ROLE avastudio_authenticated; SET app.current_user_id = '';`);
}
async function asService(): Promise<void> {
  await db.exec(`RESET ROLE;`);
}
async function countAccounts(): Promise<number> {
  const r = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM social_accounts");
  return r.rows[0]!.n;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(readFileSync(`${migDir}0000_fast_spiral.sql`, "utf8"));
  await db.exec(readFileSync(`${migDir}0001_rls.sql`, "utf8"));
  // seed как service (superuser обходит RLS)
  await db.exec(`
    INSERT INTO users (id, email) VALUES ('${USER_A}','a@t.dev'), ('${USER_B}','b@t.dev');
    INSERT INTO organizations (id, name, slug) VALUES ('${ORG_A}','A','a'), ('${ORG_B}','B','b');
    INSERT INTO org_members (org_id, user_id, role) VALUES ('${ORG_A}','${USER_A}','owner'), ('${ORG_B}','${USER_B}','owner');
    INSERT INTO social_accounts (org_id, platform, username) VALUES
      ('${ORG_A}','instagram','a1'), ('${ORG_A}','tiktok','a2'), ('${ORG_B}','reddit','b1');
  `);
});

afterEach(async () => {
  await db.exec(`RESET ROLE; SET app.current_user_id = '';`);
});

describe("RLS", () => {
  it("RLS включён на 100% таблиц public", async () => {
    const r = await db.query<{ relname: string }>(
      `SELECT relname FROM pg_class WHERE relkind='r' AND relnamespace='public'::regnamespace AND NOT relrowsecurity`,
    );
    expect(r.rows.map((x) => x.relname)).toEqual([]);
  });

  it("service-role видит все аккаунты", async () => {
    await asService();
    expect(await countAccounts()).toBe(3);
  });

  it("user A видит только аккаунты своей организации", async () => {
    await asUser(USER_A);
    const r = await db.query<{ username: string }>(
      "SELECT username FROM social_accounts ORDER BY username",
    );
    expect(r.rows.map((x) => x.username)).toEqual(["a1", "a2"]);
  });

  it("user B видит только свою организацию", async () => {
    await asUser(USER_B);
    expect(await countAccounts()).toBe(1);
  });

  it("user A не видит организацию B", async () => {
    await asUser(USER_A);
    const r = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM organizations WHERE id='${ORG_B}'`,
    );
    expect(r.rows[0]!.n).toBe(0);
  });

  it("анонимный доступ → 0 строк", async () => {
    await asAnon();
    expect(await countAccounts()).toBe(0);
  });
});
