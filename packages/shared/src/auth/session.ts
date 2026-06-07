import { randomUUID } from "node:crypto";

import { asUserId, type UserId } from "../domain/ids.js";
import { UnauthorizedError } from "../errors/index.js";

import { signJwt, verifyJwt } from "./jwt.js";

import type { AuthUser } from "./types.js";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "./edge.js";

export {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  isProtectedRoute,
  type RouteProtection,
} from "./edge.js";

/**
 * Управление сессиями (TASK 10.3): access (JWT) + refresh (opaque, хранится для ревокации),
 * httpOnly secure cookie, refresh-ротация, истечение, ревокация. Защита роутов — через
 * `requireAuth`/`getSession` (server) и Next middleware (apps/web).
 */


/** Запись refresh-сессии в сторе (для ревокации/ротации). */
export interface RefreshRecord {
  userId: UserId;
  /** Истечение refresh (Unix ms). */
  expiresAt: number;
  /** Отозвана ли (logout/ротация). */
  revoked: boolean;
}

/** Порт хранилища refresh-сессий (БД/Redis в инфраструктуре, in-memory в тестах). */
export interface SessionStore {
  save(token: string, record: RefreshRecord): Promise<void>;
  get(token: string): Promise<RefreshRecord | undefined>;
  delete(token: string): Promise<void>;
}

export interface SessionManagerOptions {
  store: SessionStore;
  jwtSecret: string;
  /** TTL access-токена, сек (по умолчанию 15 мин). */
  accessTtlSec?: number;
  /** TTL refresh-токена, сек (по умолчанию 30 дней). */
  refreshTtlSec?: number;
  /** secure-флаг cookie (false в dev по http). */
  secureCookies?: boolean;
  now?: () => Date;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  /** Готовые Set-Cookie заголовки (httpOnly). */
  cookies: string[];
}

export interface CookieAttrs {
  maxAgeSec: number;
  secure: boolean;
}

/** Сериализует httpOnly cookie. */
export function serializeCookie(name: string, value: string, attrs: CookieAttrs): string {
  const parts = [
    `${name}=${value}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${attrs.maxAgeSec}`,
  ];
  if (attrs.secure) parts.push("Secure");
  return parts.join("; ");
}

/** Cookie для удаления (logout). */
export function clearCookie(name: string): string {
  return `${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

/** Парсит заголовок Cookie в map. */
export function parseCookies(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

export class SessionManager {
  private readonly store: SessionStore;
  private readonly jwtSecret: string;
  private readonly accessTtlSec: number;
  private readonly refreshTtlSec: number;
  private readonly secure: boolean;
  private readonly now: () => Date;

  constructor(options: SessionManagerOptions) {
    this.store = options.store;
    this.jwtSecret = options.jwtSecret;
    this.accessTtlSec = options.accessTtlSec ?? 15 * 60;
    this.refreshTtlSec = options.refreshTtlSec ?? 30 * 24 * 3600;
    this.secure = options.secureCookies ?? true;
    this.now = options.now ?? (() => new Date());
  }

  private buildCookies(accessToken: string, refreshToken: string): string[] {
    return [
      serializeCookie(ACCESS_COOKIE, accessToken, { maxAgeSec: this.accessTtlSec, secure: this.secure }),
      serializeCookie(REFRESH_COOKIE, refreshToken, { maxAgeSec: this.refreshTtlSec, secure: this.secure }),
    ];
  }

  /** Создаёт новую сессию для пользователя. */
  async create(user: AuthUser): Promise<IssuedSession> {
    const nowMs = this.now().getTime();
    const iat = Math.floor(nowMs / 1000);
    const accessExpSec = iat + this.accessTtlSec;
    const accessToken = signJwt(
      { sub: user.id, iat, exp: accessExpSec, email: user.email },
      this.jwtSecret,
    );
    const refreshToken = randomUUID();
    const refreshExpiresAt = nowMs + this.refreshTtlSec * 1000;
    await this.store.save(refreshToken, { userId: user.id, expiresAt: refreshExpiresAt, revoked: false });
    return {
      accessToken,
      refreshToken,
      accessExpiresAt: accessExpSec * 1000,
      refreshExpiresAt,
      cookies: this.buildCookies(accessToken, refreshToken),
    };
  }

  /** Проверяет access-токен. Возвращает userId или null. */
  verifyAccess(accessToken: string | undefined): UserId | null {
    if (!accessToken) return null;
    const nowSec = Math.floor(this.now().getTime() / 1000);
    const res = verifyJwt(accessToken, this.jwtSecret, nowSec);
    return res.valid ? asUserId(res.claims.sub) : null;
  }

  /**
   * Ротация по refresh-токену: проверяет валидность/срок/ревокацию, выпускает новую пару,
   * старый refresh инвалидируется (одноразовость). Возвращает null, если refresh невалиден.
   */
  async refresh(refreshToken: string | undefined, user: AuthUser): Promise<IssuedSession | null> {
    if (!refreshToken) return null;
    const rec = await this.store.get(refreshToken);
    const nowMs = this.now().getTime();
    if (!rec || rec.revoked || rec.expiresAt <= nowMs || rec.userId !== user.id) return null;
    await this.store.delete(refreshToken); // ротация: старый refresh больше не действует
    return this.create(user);
  }

  /** Ревокация сессии (logout). */
  async revoke(refreshToken: string | undefined): Promise<string[]> {
    if (refreshToken) await this.store.delete(refreshToken);
    return [clearCookie(ACCESS_COOKIE), clearCookie(REFRESH_COOKIE)];
  }
}

/**
 * Server-хелпер: требует валидную сессию. Бросает UnauthorizedError, если её нет.
 * `getToken` извлекает access-токен (из cookie/заголовка) на стороне вызывающего.
 */
export function requireAuth(manager: SessionManager, accessToken: string | undefined): UserId {
  const userId = manager.verifyAccess(accessToken);
  if (!userId) {
    throw new UnauthorizedError({ userMessage: "Требуется вход в систему" });
  }
  return userId;
}

/** Server-хелпер: чтение userId из сессии без выброса (null если нет). */
export function getSessionUserId(
  manager: SessionManager,
  accessToken: string | undefined,
): UserId | null {
  return manager.verifyAccess(accessToken);
}

/** In-memory стор refresh-сессий (тесты/локально). */
export class InMemorySessionStore implements SessionStore {
  private readonly map = new Map<string, RefreshRecord>();
  save(token: string, record: RefreshRecord): Promise<void> {
    this.map.set(token, { ...record });
    return Promise.resolve();
  }
  get(token: string): Promise<RefreshRecord | undefined> {
    return Promise.resolve(this.map.get(token));
  }
  delete(token: string): Promise<void> {
    this.map.delete(token);
    return Promise.resolve();
  }
}

