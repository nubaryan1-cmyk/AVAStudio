import { describe, expect, it } from "vitest";

import { isSensitiveKey, REDACTED, redact } from "./redact.js";

describe("isSensitiveKey", () => {
  it("распознаёт чувствительные ключи", () => {
    for (const k of [
      "password",
      "accessToken",
      "cookie",
      "apiKey",
      "STRIPE_KEY",
      "authorization",
      "credentials",
    ]) {
      expect(isSensitiveKey(k)).toBe(true);
    }
  });
  it("не трогает обычные ключи", () => {
    for (const k of ["username", "id", "keyVersion", "email", "count"]) {
      expect(isSensitiveKey(k)).toBe(false);
    }
  });
});

describe("redact", () => {
  it("маскирует чувствительные поля верхнего уровня", () => {
    const out = redact({ username: "garnik", password: "p@ss" });
    expect(out.username).toBe("garnik");
    expect(out.password).toBe(REDACTED);
  });

  it("маскирует вложенные секреты, сохраняя структуру", () => {
    const out = redact({
      user: { id: 1, accessToken: "abc" },
      meta: { region: "eu" },
    });
    expect(out.user.id).toBe(1);
    expect(out.user.accessToken).toBe(REDACTED);
    expect(out.meta.region).toBe("eu");
  });

  it("маскирует в массивах объектов", () => {
    const out = redact({ accounts: [{ login: "a", cookie: "x" }] });
    expect(out.accounts[0]!.login).toBe("a");
    expect(out.accounts[0]!.cookie).toBe(REDACTED);
  });

  it("не падает на циклических ссылках", () => {
    const obj: Record<string, unknown> = { name: "n" };
    obj.self = obj;
    expect(() => redact(obj)).not.toThrow();
  });

  it("не меняет примитивы", () => {
    expect(redact("plain")).toBe("plain");
    expect(redact(42)).toBe(42);
  });
});
