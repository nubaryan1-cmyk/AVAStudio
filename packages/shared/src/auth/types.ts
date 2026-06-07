import type { OrgRole } from "../domain/enums.js";
import type { OrgId, UserId } from "../domain/ids.js";

/**
 * Абстракция аутентификации (ADR-013, TASK 10.1). Provider-agnostic: локальный драйвер
 * сейчас (Фаза 1), Supabase-драйвер в Фазе 2 — без переписывания вызывающего кода.
 */

/** Пользователь в смысле аутентификации (без секретов). */
export interface AuthUser {
  id: UserId;
  email: string;
  emailVerified: boolean;
  /** Включён ли TOTP-2FA (TASK 10.2). */
  totpEnabled: boolean;
}

/** Членство пользователя в организации с ролью (для RBAC, TASK 10.4). */
export interface OrgMembershipRef {
  orgId: OrgId;
  role: OrgRole;
}

/** Активная сессия после успешной аутентификации. */
export interface AuthSession {
  user: AuthUser;
  /** Подписанный access-токен (JWT, HS256). */
  accessToken: string;
  /** Время истечения access-токена (Unix ms). */
  expiresAt: number;
}

export interface SignUpInput {
  email: string;
  password: string;
}

export interface SignInInput {
  email: string;
  password: string;
  /** TOTP-код, если у пользователя включена 2FA (проверяется драйвером/RBAC). */
  totpCode?: string;
}

/**
 * Контракт провайдера аутентификации. Любой драйвер (local, supabase) реализует его.
 */
export interface AuthProvider {
  readonly name: string;
  signUp(input: SignUpInput): Promise<AuthSession>;
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(accessToken: string): Promise<void>;
  /** Возвращает сессию по access-токену или null, если невалиден/просрочен. */
  getSession(accessToken: string): Promise<AuthSession | null>;
  /** Подтверждает email по токену верификации. */
  verifyEmail(token: string): Promise<void>;
}
