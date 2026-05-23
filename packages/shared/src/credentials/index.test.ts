import { describe, expect, it } from "vitest";

import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  decryptJSON,
  encryptJSON,
  generateDataKey,
  unwrapDataKey,
  wrapDataKey,
  type EncryptedBlob,
} from "./index.js";

describe("AES-256-GCM", () => {
  it("round-trip: encrypt → decrypt возвращает исходный текст", () => {
    const key = generateDataKey();
    const blob = aesGcmEncrypt("super-secret-password", key);
    expect(aesGcmDecrypt(blob, key)).toBe("super-secret-password");
  });

  it("уникальный IV: одинаковый текст → разные iv и ct", () => {
    const key = generateDataKey();
    const a = aesGcmEncrypt("same", key);
    const b = aesGcmEncrypt("same", key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it("keyVersion проставляется (по умолчанию v1)", () => {
    const blob = aesGcmEncrypt("x", generateDataKey());
    expect(blob.keyVersion).toBe("v1");
    expect(blob.v).toBe(1);
  });

  it("неверный ключ → ошибка аутентификации", () => {
    const blob = aesGcmEncrypt("secret", generateDataKey());
    expect(() => aesGcmDecrypt(blob, generateDataKey())).toThrow();
  });

  it("подмена ct/tag → ошибка аутентификации", () => {
    const key = generateDataKey();
    const blob = aesGcmEncrypt("secret", key);
    const raw = Buffer.from(blob.ct, "base64");
    raw[raw.length - 1] ^= 0x01; // портим последний байт (область тега)
    const tampered: EncryptedBlob = { ...blob, ct: raw.toString("base64") };
    expect(() => aesGcmDecrypt(tampered, key)).toThrow();
  });

  it("ключ неверной длины → ошибка", () => {
    expect(() => aesGcmEncrypt("x", new Uint8Array(16))).toThrow(/32 байт/);
  });
});

describe("Envelope (KEK ↔ DEK)", () => {
  it("wrap → unwrap восстанавливает DEK", () => {
    const kek = generateDataKey();
    const dek = generateDataKey();
    const wrapped = wrapDataKey(dek, kek);
    expect(Array.from(unwrapDataKey(wrapped, kek))).toEqual(Array.from(dek));
  });

  it("полный цикл: DEK шифрует данные, KEK оборачивает DEK", () => {
    const kek = generateDataKey();
    const dek = generateDataKey();
    const wrapped = wrapDataKey(dek, kek);

    const blob = encryptJSON({ cookies: ["a=1", "b=2"] }, dek);
    const restoredDek = unwrapDataKey(wrapped, kek);
    const data = decryptJSON<{ cookies: string[] }>(blob, restoredDek);
    expect(data.cookies).toEqual(["a=1", "b=2"]);
  });

  it("чужой KEK не разворачивает DEK", () => {
    const wrapped = wrapDataKey(generateDataKey(), generateDataKey());
    expect(() => unwrapDataKey(wrapped, generateDataKey())).toThrow();
  });
});
