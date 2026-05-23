import { describe, expect, it } from "vitest";

import {
  previousKeyVersion,
  reEncrypt,
  resolveKekFromEnv,
  rotateWrappedDataKey,
} from "./rotate.js";

import { aesGcmDecrypt, aesGcmEncrypt, generateDataKey } from "./index.js";

describe("reEncrypt", () => {
  it("перешифровывает blob со старого ключа на новый, сохраняя содержимое", () => {
    const oldKey = generateDataKey();
    const newKey = generateDataKey();
    const blob = aesGcmEncrypt("secret-value", oldKey, "v1");

    const rotated = reEncrypt(blob, oldKey, newKey, "v2");

    expect(rotated.keyVersion).toBe("v2");
    expect(aesGcmDecrypt(rotated, newKey)).toBe("secret-value");
  });

  it("после ротации старый ключ больше не расшифровывает новый blob", () => {
    const oldKey = generateDataKey();
    const newKey = generateDataKey();
    const blob = aesGcmEncrypt("x", oldKey, "v1");
    const rotated = reEncrypt(blob, oldKey, newKey, "v2");
    expect(() => aesGcmDecrypt(rotated, oldKey)).toThrow();
  });
});

describe("rotateWrappedDataKey (versioned)", () => {
  it("разворачивает старым KEK (по версии блоба) и заворачивает текущим", () => {
    const oldKek = generateDataKey();
    const newKek = generateDataKey();
    const dek = generateDataKey();
    const wrappedOld = aesGcmEncrypt(Buffer.from(dek).toString("base64"), oldKek, "v1");

    const rotated = rotateWrappedDataKey(wrappedOld, {
      resolveKek: () => oldKek,
      currentKek: newKek,
      currentVersion: "v2",
    });

    expect(rotated.keyVersion).toBe("v2");
    const restored = new Uint8Array(Buffer.from(aesGcmDecrypt(rotated, newKek), "base64"));
    expect(Array.from(restored)).toEqual(Array.from(dek));
  });

  it("если blob уже на текущей версии — возвращает как есть", () => {
    const kek = generateDataKey();
    const wrapped = aesGcmEncrypt("dek", kek, "v2");
    const result = rotateWrappedDataKey(wrapped, { currentKek: kek, currentVersion: "v2" });
    expect(result).toBe(wrapped);
  });
});

describe("версии ключей", () => {
  it("previousKeyVersion выводит предыдущую метку", () => {
    expect(previousKeyVersion("v2")).toBe("v1");
    expect(previousKeyVersion("v5")).toBe("v4");
  });

  it("нет предыдущей версии для v1", () => {
    expect(() => previousKeyVersion("v1")).toThrow();
  });

  it("resolveKekFromEnv бросает на неизвестной версии (без обращения к env)", () => {
    expect(() => resolveKekFromEnv("v999")).toThrow(/Неизвестная версия/);
  });
});
