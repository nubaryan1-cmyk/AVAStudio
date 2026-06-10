import { encrypt, generateDataKey, type EncryptedBlob } from "@avastudio/shared/credentials";
import { env } from "@avastudio/shared";
import {
  createDb,
  createSocialAccount,
  deleteSocialAccount,
  getOrCreateDefaultOrg,
  listSocialAccountsForUi,
  type Database,
} from "@avastudio/db";
import { asSocialAccountId, type Platform } from "@avastudio/shared/domain";
import {
  createInstagramDriver,
  createRedditDriver,
  createSocialRegistry,
  createThreadsDriver,
  createTiktokDriver,
  getPlatform,
  type ImplMechanism,
  type SocialRegistry,
} from "@avastudio/shared/social";

/**
 * Локальный источник данных по соц-аккаунтам (Фаза 1).
 * Авторизация — через mock-драйверы (ЭТАП 12). Креды хранятся ТОЛЬКО в шифрованном виде.
 */

export type AccountStatus = "warmup" | "active" | "checkpoint" | "authorized";

export interface AccountLogEntry {
  at: string;
  action: string;
}

export interface SocialAccount {
  id: string;
  platform: Platform;
  handle: string;
  mechanism: ImplMechanism;
  status: AccountStatus;
  healthScore: number;
  lastActivity: string;
  phoneId: string | null;
  proxyId: string | null;
  sessionRef: string;
  /** Зашифрованные креды (EncryptedBlob). Плейнтекст в памяти/логах не держим. */
  encryptedCreds: EncryptedBlob;
  log: AccountLogEntry[];
}

export interface AddAccountInput {
  platform: Platform;
  handle: string;
  mechanism: ImplMechanism;
  /** Секрет: пароль/токен. Сразу шифруется, в открытом виде не сохраняется. */
  secret: string;
}

const REGISTRY: SocialRegistry = createSocialRegistry([
  createInstagramDriver(),
  createTiktokDriver(),
  createRedditDriver(),
  createThreadsDriver(),
]);

/** DEK организации (демо). В проде — per-org через wrap/unwrap KEK (ЭТАП 3.5). */
const ORG_DEK = generateDataKey();

let seq = 100;
const STORE = new Map<string, SocialAccount>();

/* ─── Персистентность в Postgres (Supabase): write-through + гидрация кэша ───
 * Синхронный интерфейс (listAccounts/getAccount) сохранён: роуты вызывают
 * ensureAccountsReady() перед чтением, дальше читают кэш STORE. */
let dbInstance: Database | null = null;
let defaultOrgId: string | null = null;
let hydrated = false;

function getDb(): Database {
  if (!dbInstance) dbInstance = createDb(env.DATABASE_URL);
  return dbInstance;
}

/** Находит/создаёт дефолт-организацию (single-tenant на тест-фазе). */
async function ensureDefaultOrg(): Promise<string> {
  if (defaultOrgId) return defaultOrgId;
  defaultOrgId = await getOrCreateDefaultOrg(getDb());
  return defaultOrgId;
}

const DB_TO_MEM: Record<string, AccountStatus> = {
  active: "active",
  warming_up: "warmup",
  checkpoint: "checkpoint",
  pending: "authorized",
};

/** Гидрация кэша из БД (один раз на процесс). Вызывать в роутах перед чтением. */
export async function ensureAccountsReady(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const orgId = await ensureDefaultOrg();
    const rows = await listSocialAccountsForUi(getDb(), orgId);
    const now = new Date().toISOString();
    for (const r of rows) {
      if (STORE.has(r.id)) continue;
      STORE.set(r.id, {
        id: r.id,
        platform: r.platform,
        handle: r.username,
        mechanism: "phone",
        status: DB_TO_MEM[r.status] ?? "authorized",
        healthScore: r.healthScore,
        lastActivity: now,
        phoneId: null,
        proxyId: null,
        sessionRef: `db-${r.id}`,
        encryptedCreds: encrypt("", ORG_DEK),
        log: [{ at: now, action: "Загружен из БД" }],
      });
    }
  } catch {
    hydrated = false; // позволить повторную попытку при сбое БД
  }
}

function seed(): void {
  if (STORE.size > 0) return;
  // Демо-аккаунты убраны (п.2 — чистка вымышленных данных): список начинается пустым
  // и наполняется реальными аккаунтами, добавленными во вкладке «Устройство».
  const presets: Array<Omit<AddAccountInput, "secret"> & { status: AccountStatus; health: number }> = [];
  for (const p of presets) {
    const id = `acc_${(seq += 1)}`;
    STORE.set(id, {
      id,
      platform: p.platform,
      handle: p.handle,
      mechanism: p.mechanism,
      status: p.status,
      healthScore: p.health,
      lastActivity: "2026-05-30T09:00:00Z",
      phoneId: p.mechanism === "phone" ? "phone_demo_1" : null,
      proxyId: "proxy_demo_1",
      sessionRef: `mock-session-${id}`,
      encryptedCreds: encrypt("seed-secret", ORG_DEK),
      log: [{ at: "2026-05-30T09:00:00Z", action: "Аккаунт добавлен (демо)" }],
    });
  }
}

export function listAccounts(platform?: Platform): SocialAccount[] {
  seed();
  const all = [...STORE.values()];
  return platform ? all.filter((a) => a.platform === platform) : all;
}

export function getAccount(id: string): SocialAccount | null {
  seed();
  return STORE.get(id) ?? null;
}

/** Добавляет аккаунт: шифрует креды, авторизует через mock-драйвер → status "authorized". */
export async function addAccount(input: AddAccountInput): Promise<SocialAccount> {
  seed();
  const id = `acc_${(seq += 1)}`;
  const driver = getPlatform(REGISTRY, input.platform);
  const session = await driver.login({
    accountId: asSocialAccountId(id),
    platform: input.platform,
    handle: input.handle,
  });
  const now = new Date().toISOString();

  const account: SocialAccount = {
    id,
    platform: input.platform,
    handle: input.handle,
    mechanism: input.mechanism,
    status: "authorized",
    healthScore: 75,
    lastActivity: now,
    phoneId: null,
    proxyId: null,
    sessionRef: session.sessionRef,
    encryptedCreds: encrypt(input.secret, ORG_DEK),
    log: [
      { at: now, action: "Креды зашифрованы (AES-256-GCM)" },
      { at: now, action: `Авторизация через mock-драйвер (${input.mechanism}) — успешно` },
    ],
  };
  STORE.set(id, account);
  // write-through в БД (не валим UI, если БД недоступна)
  try {
    const orgId = await ensureDefaultOrg();
    const { id: dbId } = await createSocialAccount(getDb(), {
      orgId,
      platform: input.platform,
      username: input.handle,
      credentials: { password: input.secret },
    });
    STORE.delete(id);
    account.id = dbId;
    account.sessionRef = `db-${dbId}`;
    STORE.set(dbId, account);
  } catch {
    /* оставляем в кэше даже если БД недоступна */
  }
  return account;
}

function mutate(id: string, fn: (a: SocialAccount) => void): SocialAccount {
  const acc = getAccount(id);
  if (!acc) throw new Error(`Аккаунт ${id} не найден`);
  fn(acc);
  STORE.set(id, acc);
  return acc;
}

export function bindPhone(id: string, phoneId: string | null): SocialAccount {
  return mutate(id, (a) => {
    a.phoneId = phoneId;
    a.log.unshift({
      at: new Date().toISOString(),
      action: phoneId ? `Привязан телефон ${phoneId}` : "Телефон отвязан",
    });
  });
}

export function bindProxy(id: string, proxyId: string | null): SocialAccount {
  return mutate(id, (a) => {
    a.proxyId = proxyId;
    a.log.unshift({
      at: new Date().toISOString(),
      action: proxyId ? `Привязан прокси ${proxyId}` : "Прокси отвязан",
    });
  });
}


/** Удаляет аккаунт из кэша и из БД. */
export async function removeAccount(id: string): Promise<void> {
  STORE.delete(id);
  try {
    const orgId = await ensureDefaultOrg();
    await deleteSocialAccount(getDb(), orgId, id);
  } catch {
    /* если БД недоступна — хотя бы из кэша убрали */
  }
}
