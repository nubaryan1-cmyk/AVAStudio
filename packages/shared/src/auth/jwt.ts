import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Минимальный HS256 JWT (TASK 10.1). Без внешних зависимостей: подпись через node:crypto.
 * Используется для access/refresh-токенов сессий. В Фазе 2 при переходе на Supabase
 * проверка делегируется их JWKS — интерфейс не меняется.
 */

const b64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const b64urlJson = (obj: unknown): string => b64url(Buffer.from(JSON.stringify(obj), "utf8"));

const fromB64url = (s: string): Buffer =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export interface JwtClaims {
  /** subject — обычно userId. */
  sub: string;
  /** issued at (сек). */
  iat: number;
  /** expiry (сек). */
  exp: number;
  /** произвольные дополнительные поля. */
  [key: string]: unknown;
}

function sign(headerPayload: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(headerPayload).digest());
}

/** Подписывает claims, возвращает компактный JWT. */
export function signJwt(claims: JwtClaims, secret: string): string {
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = b64urlJson(claims);
  const data = `${header}.${payload}`;
  return `${data}.${sign(data, secret)}`;
}

export type JwtVerifyResult =
  | { valid: true; claims: JwtClaims }
  | { valid: false; reason: "malformed" | "signature" | "expired" };

/** Проверяет подпись и срок действия. nowSec по умолчанию — текущее время. */
export function verifyJwt(
  token: string,
  secret: string,
  nowSec: number = Math.floor(Date.now() / 1000),
): JwtVerifyResult {
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, reason: "malformed" };
  const [header, payload, sig] = parts as [string, string, string];
  const expected = sign(`${header}.${payload}`, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "signature" };
  }
  let claims: JwtClaims;
  try {
    claims = JSON.parse(fromB64url(payload).toString("utf8")) as JwtClaims;
  } catch {
    return { valid: false, reason: "malformed" };
  }
  if (typeof claims.exp !== "number" || nowSec >= claims.exp) {
    return { valid: false, reason: "expired" };
  }
  return { valid: true, claims };
}
