/**
 * Waitlist + инвайты для closed beta (TASK 26.1). Чистая логика поверх порта хранилища
 * (БД в проде, in-memory в тестах). Инвайт-код одноразовый, привязан к email.
 */
import { randomUUID } from "node:crypto";

export type WaitlistStatus = "pending" | "invited" | "joined";

export interface WaitlistEntry {
  email: string;
  status: WaitlistStatus;
  inviteCode?: string;
  createdAt: Date;
  invitedAt?: Date;
}

export interface WaitlistStore {
  find(email: string): Promise<WaitlistEntry | undefined>;
  save(entry: WaitlistEntry): Promise<void>;
  findByCode(code: string): Promise<WaitlistEntry | undefined>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const norm = (e: string): string => e.trim().toLowerCase();

/** Добавляет email в waitlist (идемпотентно — повтор не создаёт дубль). */
export async function joinWaitlist(store: WaitlistStore, email: string, now: () => Date = () => new Date()): Promise<WaitlistEntry> {
  const e = norm(email);
  if (!EMAIL_RE.test(e)) throw new Error("Некорректный email");
  const existing = await store.find(e);
  if (existing) return existing;
  const entry: WaitlistEntry = { email: e, status: "pending", createdAt: now() };
  await store.save(entry);
  return entry;
}

/** Выдаёт инвайт-код (переводит pending → invited). */
export async function inviteFromWaitlist(store: WaitlistStore, email: string, now: () => Date = () => new Date()): Promise<string> {
  const e = norm(email);
  const entry = await store.find(e);
  if (!entry) throw new Error("Email не найден в waitlist");
  const inviteCode = randomUUID().slice(0, 8);
  await store.save({ ...entry, status: "invited", inviteCode, invitedAt: now() });
  return inviteCode;
}

/** Проверяет инвайт-код при регистрации. Возвращает email, если код валиден и не использован. */
export async function redeemInvite(store: WaitlistStore, code: string): Promise<string> {
  const entry = await store.findByCode(code);
  if (!entry || entry.status !== "invited") throw new Error("Недействительный инвайт-код");
  await store.save({ ...entry, status: "joined" });
  return entry.email;
}

/** In-memory store (dev/тесты). */
export class InMemoryWaitlistStore implements WaitlistStore {
  private readonly byEmail = new Map<string, WaitlistEntry>();
  find(email: string): Promise<WaitlistEntry | undefined> {
    return Promise.resolve(this.byEmail.get(norm(email)));
  }
  findByCode(code: string): Promise<WaitlistEntry | undefined> {
    return Promise.resolve([...this.byEmail.values()].find((e) => e.inviteCode === code));
  }
  save(entry: WaitlistEntry): Promise<void> {
    this.byEmail.set(norm(entry.email), { ...entry });
    return Promise.resolve();
  }
  get size(): number {
    return this.byEmail.size;
  }
}
