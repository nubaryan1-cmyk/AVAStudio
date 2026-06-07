import { encrypt, generateDataKey, type EncryptedBlob } from "@avastudio/shared/credentials";
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

function seed(): void {
  if (STORE.size > 0) return;
  const presets: Array<Omit<AddAccountInput, "secret"> & { status: AccountStatus; health: number }> = [
    { platform: "instagram", handle: "@brand.reels", mechanism: "phone", status: "active", health: 88 },
    { platform: "tiktok", handle: "@promo.short", mechanism: "browser", status: "warmup", health: 64 },
    { platform: "reddit", handle: "u/brand_official", mechanism: "api", status: "checkpoint", health: 42 },
    { platform: "threads", handle: "@brand.threads", mechanism: "api", status: "active", health: 91 },
  ];
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
