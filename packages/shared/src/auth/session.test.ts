import { describe, expect, it } from "vitest";

import { asUserId } from "../domain/ids.js";

import {
  ACCESS_COOKIE,
  InMemorySessionStore,
  REFRESH_COOKIE,
  SessionManager,
  clearCookie,
  getSessionUserId,
  isProtectedRoute,
  parseCookies,
  requireAuth,
  serializeCookie,
} from "./session.js";

import type { AuthUser } from "./types.js";

const user: AuthUser = {
  id: asUserId("123e4567-e89b-12d3-a456-426614174000"),
  email: "u@a.app",
  emailVerified: true,
  totpEnabled: false,
};

function mgr(now: () => Date = () => new Date("2026-05-30T10:00:00.000Z")) {
  return new SessionManager({ store: new InMemorySessionStore(), jwtSecret: "s", now });
}

describe("Сессии (TASK 10.3)", () => {
  it("create → cookie httpOnly + валидный access", async () => {
    const m = mgr();
    const s = await m.create(user);
    expect(s.cookies[0]).toContain(`${ACCESS_COOKIE}=`);
    expect(s.cookies[0]).toContain("HttpOnly");
    expect(s.cookies[1]).toContain(`${REFRESH_COOKIE}=`);
    expect(m.verifyAccess(s.accessToken)).toBe(user.id);
  });

  it("requireAuth: без токена → throw; с токеном → userId", async () => {
    const m = mgr();
    const s = await m.create(user);
    expect(() => requireAuth(m, undefined)).toThrow();
    expect(requireAuth(m, s.accessToken)).toBe(user.id);
    expect(getSessionUserId(m, undefined)).toBeNull();
  });

  it("refresh ротирует токен; старый refresh инвалидируется", async () => {
    const m = mgr();
    const s = await m.create(user);
    const r1 = await m.refresh(s.refreshToken, user);
    expect(r1).not.toBeNull();
    expect(r1!.refreshToken).not.toBe(s.refreshToken);
    // старый refresh больше не действует
    expect(await m.refresh(s.refreshToken, user)).toBeNull();
  });

  it("revoke очищает cookie и инвалидирует refresh", async () => {
    const m = mgr();
    const s = await m.create(user);
    const cookies = await m.revoke(s.refreshToken);
    expect(cookies[0]).toContain("Max-Age=0");
    expect(await m.refresh(s.refreshToken, user)).toBeNull();
  });

  it("истёкший access не проходит verifyAccess", async () => {
    let t = new Date("2026-05-30T10:00:00.000Z");
    const m = new SessionManager({
      store: new InMemorySessionStore(),
      jwtSecret: "s",
      accessTtlSec: 60,
      now: () => t,
    });
    const s = await m.create(user);
    t = new Date("2026-05-30T10:02:00.000Z");
    expect(m.verifyAccess(s.accessToken)).toBeNull();
  });

  it("cookie helpers: serialize/parse/clear", () => {
    const c = serializeCookie("x", "y", { maxAgeSec: 100, secure: true });
    expect(c).toContain("Secure");
    expect(parseCookies("a=1; b=2")).toEqual({ a: "1", b: "2" });
    expect(clearCookie("x")).toContain("Max-Age=0");
  });

  it("isProtectedRoute: защищённые/публичные префиксы", () => {
    const cfg = { protectedPrefixes: ["/dashboard"], publicPrefixes: ["/login"] };
    expect(isProtectedRoute("/dashboard/x", cfg)).toBe(true);
    expect(isProtectedRoute("/login", cfg)).toBe(false);
    expect(isProtectedRoute("/", cfg)).toBe(false);
  });
});
