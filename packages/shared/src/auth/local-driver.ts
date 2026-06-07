import { randomUUID } from "node:crypto";

import { asUserId, type UserId } from "../domain/ids.js";
import { ConflictError, UnauthorizedError, ValidationError } from "../errors/index.js";

import { signJwt, verifyJwt } from "./jwt.js";
import { hashPassword, verifyPassword } from "./password.js";

import type {
  AuthProvider,
  AuthSession,
  AuthUser,
  SignInInput,
  SignUpInput,
} from "./types.js";


/**
 * Локальный драйвер аутентификации (TASK 10.1). Хранение абстрагировано портом UserStore
 * (реальная БД в инфраструктуре, in-memory фейк в тестах). Пароли — bcrypt; сессии — HS256 JWT.
 */

/** Запись пользователя в хранилище (с секретами — не покидает слой auth). */
export interface StoredUser {
  id: UserId;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  totpEnabled: boolean;
  /** Одноразовый токен верификации email. */
  emailVerifyToken?: string;
}

/** Порт хранилища пользователей. */
export interface UserStore {
  findByEmail(email: string): Promise<StoredUser | undefined>;
  findById(id: UserId): Promise<StoredUser | undefined>;
  create(user: StoredUser): Promise<void>;
  update(user: StoredUser): Promise<void>;
}

export interface LocalAuthOptions {
  store: UserStore;
  /** Секрет подписи JWT (из env, напр. AUTH_JWT_SECRET). */
  jwtSecret: string;
  /** TTL access-токена в секундах (по умолчанию 1 час). */
  accessTtlSec?: number;
  /** Источник времени (детерминизм в тестах). */
  now?: () => Date;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normEmail = (e: string): string => e.trim().toLowerCase();

function toAuthUser(u: StoredUser): AuthUser {
  return { id: u.id, email: u.email, emailVerified: u.emailVerified, totpEnabled: u.totpEnabled };
}

export class LocalAuthProvider implements AuthProvider {
  readonly name = "local";
  private readonly store: UserStore;
  private readonly jwtSecret: string;
  private readonly accessTtlSec: number;
  private readonly now: () => Date;
  /** Ревокация stateless-токенов (signOut). Сессионный стор — TASK 10.3. */
  private readonly revoked = new Set<string>();

  constructor(options: LocalAuthOptions) {
    this.store = options.store;
    this.jwtSecret = options.jwtSecret;
    this.accessTtlSec = options.accessTtlSec ?? 3600;
    this.now = options.now ?? (() => new Date());
  }

  private issue(user: StoredUser): AuthSession {
    const iat = Math.floor(this.now().getTime() / 1000);
    const exp = iat + this.accessTtlSec;
    const accessToken = signJwt({ sub: user.id, iat, exp, email: user.email }, this.jwtSecret);
    return { user: toAuthUser(user), accessToken, expiresAt: exp * 1000 };
  }

  async signUp(input: SignUpInput): Promise<AuthSession> {
    const email = normEmail(input.email);
    if (!EMAIL_RE.test(email)) {
      throw new ValidationError({ userMessage: "Некорректный email" });
    }
    if (await this.store.findByEmail(email)) {
      throw new ConflictError({ userMessage: "Пользователь с таким email уже существует" });
    }
    const user: StoredUser = {
      id: asUserId(randomUUID()),
      email,
      passwordHash: await hashPassword(input.password),
      emailVerified: false,
      totpEnabled: false,
      emailVerifyToken: randomUUID(),
    };
    await this.store.create(user);
    return this.issue(user);
  }

  async signIn(input: SignInInput): Promise<AuthSession> {
    const email = normEmail(input.email);
    const user = await this.store.findByEmail(email);
    // Единое сообщение, чтобы не раскрывать существование email.
    const fail = (): never => {
      throw new UnauthorizedError({ userMessage: "Неверный email или пароль" });
    };
    if (!user) {
      // Сглаживаем тайминг: всё равно делаем bcrypt-сравнение с фиктивным хешем.
      await verifyPassword(input.password, "$2a$12$0000000000000000000000000000000000000000000000000000");
      return fail();
    }
    if (!(await verifyPassword(input.password, user.passwordHash))) return fail();
    return this.issue(user);
  }

  signOut(accessToken: string): Promise<void> {
    this.revoked.add(accessToken);
    return Promise.resolve();
  }

  async getSession(accessToken: string): Promise<AuthSession | null> {
    if (this.revoked.has(accessToken)) return null;
    const nowSec = Math.floor(this.now().getTime() / 1000);
    const res = verifyJwt(accessToken, this.jwtSecret, nowSec);
    if (!res.valid) return null;
    const user = await this.store.findById(asUserId(res.claims.sub));
    if (!user) return null;
    return { user: toAuthUser(user), accessToken, expiresAt: (res.claims.exp ?? 0) * 1000 };
  }

  async verifyEmail(token: string): Promise<void> {
    // Линейный поиск приемлем для локального драйвера/тестов; в БД — индекс по токену.
    const all = await (this.store as UserStore & { all?: () => Promise<StoredUser[]> }).all?.();
    const user = all?.find((u) => u.emailVerifyToken === token);
    if (!user) throw new ValidationError({ userMessage: "Недействительный токен верификации" });
    user.emailVerified = true;
    delete user.emailVerifyToken;
    await this.store.update(user);
  }
}

/** In-memory хранилище пользователей (тесты/локально). */
export class InMemoryUserStore implements UserStore {
  private readonly byId = new Map<UserId, StoredUser>();

  findByEmail(email: string): Promise<StoredUser | undefined> {
    const e = normEmail(email);
    return Promise.resolve([...this.byId.values()].find((u) => u.email === e));
  }
  findById(id: UserId): Promise<StoredUser | undefined> {
    return Promise.resolve(this.byId.get(id));
  }
  create(user: StoredUser): Promise<void> {
    this.byId.set(user.id, { ...user });
    return Promise.resolve();
  }
  update(user: StoredUser): Promise<void> {
    this.byId.set(user.id, { ...user });
    return Promise.resolve();
  }
  all(): Promise<StoredUser[]> {
    return Promise.resolve([...this.byId.values()]);
  }
}
