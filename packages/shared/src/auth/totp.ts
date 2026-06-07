import { randomInt } from "node:crypto";

import { generateSecret, generateSync, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

import { decrypt, encrypt, type EncryptedBlob } from "../credentials/index.js";

import { hashToken, verifyToken } from "./password.js";

/**
 * TOTP-двухфакторка (TASK 10.2), совместимая с Google Authenticator (otplib v13).
 * Секрет хранится ЗАШИФРОВАННЫМ (credentials-модуль, ЭТАП 2). Секреты не логируются.
 */

/** Кол-во одноразовых backup-кодов. */
export const BACKUP_CODES_COUNT = 10;

/** Генерирует TOTP-секрет (base32). */
export function generateTotpSecret(): string {
  return generateSecret();
}

/** otpauth://-URL для QR (содержит секрет в открытом виде — так работает TOTP). */
export function buildOtpAuthUrl(secret: string, accountName: string, issuer: string): string {
  return generateURI({ strategy: "totp", issuer, label: accountName, secret });
}

/** Data-URL PNG QR-кода для enroll. */
export function totpQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

export interface TotpEnrollment {
  /** Зашифрованный секрет — для хранения в БД. */
  secretEncrypted: EncryptedBlob;
  /** otpauth URL (показать/спрятать). */
  otpauthUrl: string;
  /** Data-URL QR-кода для показа пользователю. */
  qrCodeDataUrl: string;
}

export interface EnrollInput {
  accountName: string;
  issuer?: string;
  /** Ключ данных (DEK) для шифрования секрета. */
  dek: Uint8Array;
}

/**
 * Enroll-flow шаг 1: генерируем секрет, отдаём QR + зашифрованный секрет.
 * Активация — только после подтверждения кодом (`verifyTotp`) на стороне вызывающего.
 */
export async function enrollTotp(input: EnrollInput): Promise<TotpEnrollment> {
  const issuer = input.issuer ?? "AVAStudio";
  const secret = generateTotpSecret();
  const otpauthUrl = buildOtpAuthUrl(secret, input.accountName, issuer);
  const qrCodeDataUrl = await totpQrCodeDataUrl(otpauthUrl);
  return { secretEncrypted: encrypt(secret, input.dek), otpauthUrl, qrCodeDataUrl };
}

/** Проверяет TOTP-код против зашифрованного секрета (±1 окно, анти-clock-skew). */
export function verifyTotp(token: string, secretEncrypted: EncryptedBlob, dek: Uint8Array): boolean {
  const secret = decrypt(secretEncrypted, dek);
  return verifySync({ strategy: "totp", secret, token: token.trim(), epochTolerance: 30 }).valid;
}

/** Генерирует TOTP-код для заданного секрета (тесты/симметрия). */
export function generateTotpToken(secret: string): string {
  return generateSync({ strategy: "totp", secret });
}

export interface BackupCodes {
  /** Коды в открытом виде — показать пользователю ОДИН раз. */
  codes: string[];
  /** Хеши кодов — для хранения. */
  hashes: string[];
}

/** Генерирует одноразовые backup-коды и их хеши (bcrypt). */
export async function generateBackupCodes(count = BACKUP_CODES_COUNT): Promise<BackupCodes> {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // 10-значный код, группами по 5: XXXXX-XXXXX
    const n = randomInt(0, 1e10).toString().padStart(10, "0");
    codes.push(`${n.slice(0, 5)}-${n.slice(5)}`);
  }
  const hashes = await Promise.all(codes.map((c) => hashToken(c)));
  return { codes, hashes };
}

export interface BackupVerifyResult {
  ok: boolean;
  /** Оставшиеся хеши (использованный код удалён — одноразовость). */
  remainingHashes: string[];
}

/** Проверяет backup-код; при совпадении расходует его (удаляет хеш). */
export async function verifyBackupCode(
  code: string,
  hashes: string[],
): Promise<BackupVerifyResult> {
  const trimmed = code.trim();
  for (let i = 0; i < hashes.length; i++) {
    const h = hashes[i];
    if (h && (await verifyToken(trimmed, h))) {
      const remainingHashes = hashes.filter((_, idx) => idx !== i);
      return { ok: true, remainingHashes };
    }
  }
  return { ok: false, remainingHashes: hashes };
}
