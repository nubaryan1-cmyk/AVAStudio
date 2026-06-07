import bcrypt from "bcryptjs";

/**
 * Хеширование паролей (TASK 10.1) и высокоэнтропийных токенов/backup-кодов (TASK 10.2).
 * bcrypt (pure-JS bcryptjs). Открытые значения НЕ хранятся и НЕ логируются.
 */

/** Cost-фактор bcrypt для паролей (вводятся людьми → нужен высокий cost). */
export const BCRYPT_ROUNDS = 12;

/** Cost-фактор для высокоэнтропийных значений (backup-коды): ниже, т.к. перебор нереалистичен. */
export const BCRYPT_ROUNDS_TOKEN = 8;

/** Минимальная длина пароля. */
export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`);
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Хеш для высокоэнтропийного токена/backup-кода (без проверки длины, низкий cost). */
export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, BCRYPT_ROUNDS_TOKEN);
}

export async function verifyToken(token: string, hash: string): Promise<boolean> {
  return bcrypt.compare(token, hash);
}
