import { asUserId } from "../../domain/ids.js";
import { ConflictError, UnauthorizedError, ValidationError } from "../../errors/index.js";

import type {
  AuthProvider,
  AuthSession,
  AuthUser,
  SignInInput,
  SignUpInput,
} from "../types.js";

/**
 * Supabase-драйвер аутентификации (TASK 16.3). Реализует тот же AuthProvider-контракт
 * (ЭТАП 10.1), что и LocalAuthProvider, — вызывающий код (UI/tRPC) НЕ меняется.
 *
 * Зависит только от минимального структурного порта Supabase Auth (ниже), а не от
 * конкретной версии SDK, — поэтому драйвер тестируем без сети и не привязан к версии.
 * В рантайме сюда передаётся клиент `@supabase/supabase-js` (createClient(...).auth).
 */

/** Структурный порт того, что драйвер использует из supabase.auth (provider-agnostic). */
export interface SupabaseAuthPort {
  signUp(creds: { email: string; password: string }): Promise<SupabaseAuthResponse>;
  signInWithPassword(creds: { email: string; password: string }): Promise<SupabaseAuthResponse>;
  getUser(jwt: string): Promise<SupabaseUserResponse>;
  signOut(): Promise<{ error: SupabaseError | null }>;
}

export interface SupabaseError {
  message: string;
  status?: number;
  code?: string;
}
export interface SupabaseUser {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  factors?: unknown[] | null;
}
export interface SupabaseSession {
  access_token: string;
  expires_at?: number; // Unix seconds
}
export interface SupabaseAuthResponse {
  data: { user: SupabaseUser | null; session: SupabaseSession | null };
  error: SupabaseError | null;
}
export interface SupabaseUserResponse {
  data: { user: SupabaseUser | null };
  error: SupabaseError | null;
}

export interface SupabaseAuthOptions {
  client: SupabaseAuthPort;
  /** TTL по умолчанию, если Supabase не вернул expires_at (сек). */
  fallbackTtlSec?: number;
  now?: () => Date;
}

function toAuthUser(u: SupabaseUser): AuthUser {
  return {
    id: asUserId(u.id),
    email: u.email ?? "",
    emailVerified: u.email_confirmed_at != null,
    totpEnabled: Array.isArray(u.factors) && u.factors.length > 0,
  };
}

export class SupabaseAuthProvider implements AuthProvider {
  readonly name = "supabase";
  private readonly client: SupabaseAuthPort;
  private readonly fallbackTtlSec: number;
  private readonly now: () => Date;

  constructor(options: SupabaseAuthOptions) {
    this.client = options.client;
    this.fallbackTtlSec = options.fallbackTtlSec ?? 3600;
    this.now = options.now ?? ((): Date => new Date());
  }

  private toSession(user: SupabaseUser, session: SupabaseSession): AuthSession {
    const expiresAt =
      session.expires_at != null
        ? session.expires_at * 1000
        : this.now().getTime() + this.fallbackTtlSec * 1000;
    return { user: toAuthUser(user), accessToken: session.access_token, expiresAt };
  }

  async signUp(input: SignUpInput): Promise<AuthSession> {
    const { data, error } = await this.client.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });
    if (error) {
      // Supabase возвращает 422/user_already_exists при дубле.
      if (error.status === 422 || error.code === "user_already_exists") {
        throw new ConflictError({ userMessage: "Пользователь с таким email уже существует" });
      }
      throw new ValidationError({ userMessage: error.message });
    }
    if (!data.user || !data.session) {
      // Email-confirmation включён: пользователь создан, сессии ещё нет.
      throw new ValidationError({
        userMessage: "Подтвердите email — мы отправили письмо со ссылкой.",
      });
    }
    return this.toSession(data.user, data.session);
  }

  async signIn(input: SignInInput): Promise<AuthSession> {
    const { data, error } = await this.client.signInWithPassword({
      email: input.email.trim().toLowerCase(),
      password: input.password,
    });
    if (error || !data.user || !data.session) {
      throw new UnauthorizedError({ userMessage: "Неверный email или пароль" });
    }
    return this.toSession(data.user, data.session);
  }

  async signOut(_accessToken: string): Promise<void> {
    await this.client.signOut();
  }

  async getSession(accessToken: string): Promise<AuthSession | null> {
    const { data, error } = await this.client.getUser(accessToken);
    if (error || !data.user) return null;
    return this.toSession(data.user, { access_token: accessToken });
  }

  verifyEmail(_token: string): Promise<void> {
    // На Supabase подтверждение email идёт по ссылке из письма (PKCE/OTP-redirect),
    // обрабатывается на стороне Supabase Auth, отдельный вызов не требуется.
    return Promise.resolve();
  }
}
