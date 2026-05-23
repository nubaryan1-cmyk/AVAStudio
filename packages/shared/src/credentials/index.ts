import { randomBytes } from "node:crypto";

import { gcm } from "@noble/ciphers/aes.js";

import { env } from "../env/index.js";

/**
 * Шифрование user-credentials (ADR-009): AES-256-GCM + envelope encryption.
 *
 * Уровни ключей:
 *   KEK (CREDENTIALS_ENCRYPTION_KEY)  →  wrap/unwrap  →  DEK (на организацию)  →  encrypt/decrypt  →  данные.
 *
 * ВАЖНО: расшифрованные значения (пароли/токены/cookies) и DEK НЕЛЬЗЯ держать в памяти/логах
 * дольше необходимого. Используй сразу и не сохраняй. В логи — только через redaction (TASK 2.4).
 */

const KEY_BYTES = 32; // AES-256
const NONCE_BYTES = 12; // 96-битный nonce — рекомендация для GCM
export const CURRENT_KEY_VERSION = "v1";

/** Сериализуемый формат шифртекста для хранения в БД (jsonb). */
export interface EncryptedBlob {
  /** Версия формата блоба. */
  v: 1;
  /** Версия ключа, которым зашифровано (для ротации — TASK 2.4). */
  keyVersion: string;
  /** Nonce (IV), base64. Уникален на каждое шифрование. */
  iv: string;
  /** Шифртекст вместе с GCM-тегом аутентификации (формат @noble), base64. */
  ct: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const toB64 = (b: Uint8Array): string => Buffer.from(b).toString("base64");
const fromB64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));

function assertKey(key: Uint8Array): void {
  if (key.length !== KEY_BYTES) {
    throw new Error(`Ключ должен быть ${KEY_BYTES} байт, получено ${key.length}`);
  }
}

/** Низкоуровневое AES-256-GCM шифрование строки заданным ключом. */
export function aesGcmEncrypt(
  plaintext: string,
  key: Uint8Array,
  keyVersion: string = CURRENT_KEY_VERSION,
): EncryptedBlob {
  assertKey(key);
  const iv = new Uint8Array(randomBytes(NONCE_BYTES));
  const ct = gcm(key, iv).encrypt(enc.encode(plaintext));
  return { v: 1, keyVersion, iv: toB64(iv), ct: toB64(ct) };
}

/** Низкоуровневая расшифровка. Бросает ошибку при неверном ключе или повреждённых данных (GCM-аутентификация). */
export function aesGcmDecrypt(blob: EncryptedBlob, key: Uint8Array): string {
  assertKey(key);
  const plaintext = gcm(key, fromB64(blob.iv)).decrypt(fromB64(blob.ct));
  return dec.decode(plaintext);
}

/** Декодирует KEK из env (base64 → 32 байта). */
function getKek(): Uint8Array {
  const key = fromB64(env.CREDENTIALS_ENCRYPTION_KEY);
  assertKey(key);
  return key;
}

/** Генерирует случайный 256-битный DEK (ключ данных организации). */
export function generateDataKey(): Uint8Array {
  return new Uint8Array(randomBytes(KEY_BYTES));
}

/** Оборачивает (шифрует) DEK мастер-ключом KEK для хранения в БД. */
export function wrapDataKey(dek: Uint8Array, kek: Uint8Array = getKek()): EncryptedBlob {
  assertKey(dek);
  return aesGcmEncrypt(toB64(dek), kek);
}

/** Разворачивает (расшифровывает) DEK мастер-ключом KEK. */
export function unwrapDataKey(wrapped: EncryptedBlob, kek: Uint8Array = getKek()): Uint8Array {
  return fromB64(aesGcmDecrypt(wrapped, kek));
}

/** Шифрует данные пользователя ключом данных (DEK). */
export function encrypt(plaintext: string, dek: Uint8Array): EncryptedBlob {
  return aesGcmEncrypt(plaintext, dek);
}

/** Расшифровывает данные пользователя ключом данных (DEK). */
export function decrypt(blob: EncryptedBlob, dek: Uint8Array): string {
  return aesGcmDecrypt(blob, dek);
}

/** Шифрует произвольную структуру (например, массив cookies). */
export function encryptJSON<T>(value: T, dek: Uint8Array): EncryptedBlob {
  return encrypt(JSON.stringify(value), dek);
}

/** Расшифровывает структуру, ранее зашифрованную encryptJSON. */
export function decryptJSON<T>(blob: EncryptedBlob, dek: Uint8Array): T {
  return JSON.parse(decrypt(blob, dek)) as T;
}
