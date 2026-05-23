import { describe, expect, it } from "vitest";

import { parseServerEnv } from "./index.js";

const VALID = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/avastudio",
  REDIS_URL: "redis://localhost:6379",
  CREDENTIALS_ENCRYPTION_KEY: `${"A".repeat(43)}=`,
};

describe("parseServerEnv", () => {
  it("парсит валидное окружение и типизирует значения", () => {
    const env = parseServerEnv(VALID);
    expect(env.DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(env.NODE_ENV).toBe("test");
  });

  it("игнорирует посторонние переменные окружения", () => {
    const env = parseServerEnv({ ...VALID, SOME_OTHER_VAR: "x" });
    expect(env.REDIS_URL).toBe(VALID.REDIS_URL);
  });

  it("падает с понятной ошибкой при отсутствии обязательных", () => {
    expect(() => parseServerEnv({})).toThrowError(/Невалидные переменные окружения/);
  });

  it("в ошибке перечислены имена недостающих переменных", () => {
    let message = "";
    try {
      parseServerEnv({});
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("DATABASE_URL");
    expect(message).toContain("REDIS_URL");
    expect(message).toContain("CREDENTIALS_ENCRYPTION_KEY");
  });

  it("отклоняет ключ шифрования неверной длины", () => {
    expect(() =>
      parseServerEnv({ ...VALID, CREDENTIALS_ENCRYPTION_KEY: "too-short" }),
    ).toThrowError(/CREDENTIALS_ENCRYPTION_KEY/);
  });

  it("отклоняет невалидный DATABASE_URL", () => {
    expect(() => parseServerEnv({ ...VALID, DATABASE_URL: "not-a-url" })).toThrowError(
      /DATABASE_URL/,
    );
  });
});
