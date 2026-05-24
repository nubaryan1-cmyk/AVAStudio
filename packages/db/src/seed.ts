import { env } from "@avastudio/shared";
import { eq, inArray } from "drizzle-orm";

import { createDb } from "./client.js";
import {
  mediaAssets,
  orgMembers,
  organizations,
  socialAccounts,
  subscriptions,
  users,
} from "./schema/index.js";

// Детерминированные id для идемпотентности seed.
const OWNER_ID = "00000000-0000-4000-8000-000000000001";
const EDITOR_ID = "00000000-0000-4000-8000-000000000002";
const ORG_ID = "00000000-0000-4000-8000-000000000010";
const SEED_EMAILS = ["owner@avastudio.dev", "editor@avastudio.dev"];

async function main(): Promise<void> {
  const db = createDb(env.DATABASE_URL);

  // Идемпотентность: удалить прошлый seed (cascade уберёт членов/аккаунты/медиа/подписки org).
  await db.delete(organizations).where(eq(organizations.id, ORG_ID));
  await db.delete(users).where(inArray(users.email, SEED_EMAILS));

  await db.insert(users).values([
    { id: OWNER_ID, email: "owner@avastudio.dev", name: "Seed Owner" },
    { id: EDITOR_ID, email: "editor@avastudio.dev", name: "Seed Editor" },
  ]);

  await db.insert(organizations).values({
    id: ORG_ID,
    name: "Seed Workspace",
    slug: "seed-workspace",
    createdBy: OWNER_ID,
  });

  await db.insert(orgMembers).values([
    { orgId: ORG_ID, userId: OWNER_ID, role: "owner" },
    { orgId: ORG_ID, userId: EDITOR_ID, role: "editor" },
  ]);

  // credentialsEncrypted остаётся null — шифрование подключается в TASK 3.5.
  await db.insert(socialAccounts).values([
    { orgId: ORG_ID, platform: "instagram", username: "seed_ig" },
    { orgId: ORG_ID, platform: "tiktok", username: "seed_tt" },
    { orgId: ORG_ID, platform: "reddit", username: "seed_rd" },
  ]);

  await db.insert(mediaAssets).values([
    { orgId: ORG_ID, type: "video", storagePath: "seed/clip1.mp4", durationSec: 15 },
    { orgId: ORG_ID, type: "image", storagePath: "seed/img1.jpg" },
  ]);

  await db.insert(subscriptions).values({
    orgId: ORG_ID,
    provider: "stripe",
    planId: "pro",
    tier: "b2c",
    status: "trialing",
  });

  console.log("Seed применён: 1 org, 2 users, 3 accounts, 2 media, 1 subscription");
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
