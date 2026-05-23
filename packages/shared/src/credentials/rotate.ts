import { env } from "../env/index.js";

import { aesGcmDecrypt, aesGcmEncrypt, CURRENT_KEY_VERSION, type EncryptedBlob } from "./index.js";

/**
 * Ротация ключей шифрования (ADR-009, envelope).
 *
 * Модель версий: keyVersion — монотонная метка "v1", "v2", ...
 * Текущий ключ (env.CREDENTIALS_ENCRYPTION_KEY) имеет версию CURRENT_KEY_VERSION.
 * Предыдущий (env.CREDENTIALS_ENCRYPTION_KEY_PREV) — версию на единицу меньше.
 *
 * Ротация KEK = перешифровать (re-wrap) все обёрнутые DEK с нового ключа.
 * Сами cred-блобы (зашифрованы DEK) при ротации KEK НЕ трогаются — в этом смысл envelope.
 *
 * ВАЖНО: расшифрованные ключи/данные не сохранять дольше необходимого.
 */

const fromB64 = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64"));

/** Метка версии предыдущего ключа, выведенная из текущей (v2 → v1). */
export function previousKeyVersion(current: string = CURRENT_KEY_VERSION): string {
  const n = Number.parseInt(current.replace(/^v/, ""), 10);
  if (!Number.isFinite(n) || n <= 1) {
    throw new Error(`Нет предыдущей версии для ${current}`);
  }
  return `v${n - 1}`;
}

/** Резолвит KEK по версии ключа из окружения (current или prev). */
export function resolveKekFromEnv(keyVersion: string): Uint8Array {
  if (keyVersion === CURRENT_KEY_VERSION) {
    return fromB64(env.CREDENTIALS_ENCRYPTION_KEY);
  }
  let prevVersion: string | null = null;
  try {
    prevVersion = previousKeyVersion();
  } catch {
    prevVersion = null;
  }
  if (prevVersion !== null && keyVersion === prevVersion) {
    if (!env.CREDENTIALS_ENCRYPTION_KEY_PREV) {
      throw new Error(
        `CREDENTIALS_ENCRYPTION_KEY_PREV требуется для версии ${keyVersion}, но не задан`,
      );
    }
    return fromB64(env.CREDENTIALS_ENCRYPTION_KEY_PREV);
  }
  throw new Error(`Неизвестная версия ключа: ${keyVersion}`);
}

/**
 * Перешифровывает blob со старого ключа на новый (batch-ротация).
 * Универсальная функция с явными ключами — основа любой ротации.
 */
export function reEncrypt(
  blob: EncryptedBlob,
  oldKey: Uint8Array,
  newKey: Uint8Array,
  newKeyVersion: string = CURRENT_KEY_VERSION,
): EncryptedBlob {
  const plaintext = aesGcmDecrypt(blob, oldKey);
  return aesGcmEncrypt(plaintext, newKey, newKeyVersion);
}

/** Опции для подмены ключей в тестах (по умолчанию берутся из env). */
export interface RotateOptions {
  resolveKek?: (keyVersion: string) => Uint8Array;
  currentKek?: Uint8Array;
  currentVersion?: string;
}

/** Ротация одного обёрнутого DEK: со старого KEK (по версии блоба) на текущий. */
export function rotateWrappedDataKey(
  wrapped: EncryptedBlob,
  options: RotateOptions = {},
): EncryptedBlob {
  const resolveKek = options.resolveKek ?? resolveKekFromEnv;
  const currentKek = options.currentKek ?? fromB64(env.CREDENTIALS_ENCRYPTION_KEY);
  const currentVersion = options.currentVersion ?? CURRENT_KEY_VERSION;

  if (wrapped.keyVersion === currentVersion) {
    return wrapped; // уже на текущем ключе — пропускаем
  }
  const oldKek = resolveKek(wrapped.keyVersion);
  return reEncrypt(wrapped, oldKek, currentKek, currentVersion);
}
