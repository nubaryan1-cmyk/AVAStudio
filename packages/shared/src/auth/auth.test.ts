import { describe, expect, it } from "vitest";

import { asUserId } from "../domain/ids.js";

import { InMemoryUserStore, LocalAuthProvider } from "./local-driver.js";
import { verifyPassword } from "./password.js";
import { rlsContextSql, rlsResetSql } from "./rls.js";

function makeAuth() {
  const store = new InMemoryUserStore();
  const auth = new LocalAuthProvider({ store, jwtSecret: "test_secret" });
  return { store, auth };
}

describe("LocalAuthProvider (TASK 10.1)", () => {
  it("signup → login → session valid → logout", async () => {
    const { auth } = makeAuth();
    const signup = await auth.signUp({ email: "a@b.com", password: "password123" });
    expect(signup.user.email).toBe("a@b.com");
    expect(signup.accessToken).toContain(".");

    const login = await auth.signIn({ email: "A@B.com", password: "password123" });
    const session = await auth.getSession(login.accessToken);
    expect(session?.user.email).toBe("a@b.com");

    await auth.signOut(login.accessToken);
    expect(await auth.getSession(login.accessToken)).toBeNull();
  });

  it("пароль хранится хешированным (bcrypt), не в открытом виде", async () => {
    const { store, auth } = makeAuth();
    await auth.signUp({ email: "h@b.com", password: "password123" });
    const u = await store.findByEmail("h@b.com");
    expect(u?.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(u?.passwordHash).not.toContain("password123");
    expect(await verifyPassword("password123", u!.passwordHash)).toBe(true);
  });

  it("неверный пароль → Unauthorized", async () => {
    const { auth } = makeAuth();
    await auth.signUp({ email: "c@b.com", password: "password123" });
    await expect(auth.signIn({ email: "c@b.com", password: "wrongpass1" })).rejects.toThrow();
  });

  it("дубль email → Conflict", async () => {
    const { auth } = makeAuth();
    await auth.signUp({ email: "d@b.com", password: "password123" });
    await expect(auth.signUp({ email: "d@b.com", password: "password123" })).rejects.toThrow();
  });

  it("несуществующий email → Unauthorized (без раскрытия)", async () => {
    const { auth } = makeAuth();
    await expect(auth.signIn({ email: "nope@b.com", password: "password123" })).rejects.toThrow();
  });

  it("verifyEmail помечает email подтверждённым", async () => {
    const { store, auth } = makeAuth();
    await auth.signUp({ email: "v@b.com", password: "password123" });
    const u = await store.findByEmail("v@b.com");
    await auth.verifyEmail(u!.emailVerifyToken!);
    const after = await store.findByEmail("v@b.com");
    expect(after?.emailVerified).toBe(true);
  });

  it("истёкший токен → getSession null", async () => {
    const store = new InMemoryUserStore();
    let t = new Date("2026-05-30T10:00:00.000Z");
    const auth = new LocalAuthProvider({ store, jwtSecret: "s", accessTtlSec: 60, now: () => t });
    const s = await auth.signUp({ email: "e@b.com", password: "password123" });
    t = new Date("2026-05-30T10:02:00.000Z"); // +2 мин > 60 сек
    expect(await auth.getSession(s.accessToken)).toBeNull();
  });

  it("RLS-контекст: SET app.current_user_id + reset", () => {
    const uid = asUserId("123e4567-e89b-12d3-a456-426614174000");
    expect(rlsContextSql(uid)).toBe(
      "SET app.current_user_id = '123e4567-e89b-12d3-a456-426614174000'",
    );
    expect(rlsResetSql()).toBe("SET app.current_user_id = ''");
    expect(() => rlsContextSql(asUserId("x'; DROP TABLE"))).toThrow();
  });
});
