import { describe, expect, it } from "vitest";

import {
  SupabaseAuthProvider,
  type SupabaseAuthPort,
  type SupabaseAuthResponse,
  type SupabaseUserResponse,
} from "./supabase.js";

/** Фейковый Supabase Auth-порт (без сети) для проверки маппинга драйвера. */
function fakePort(over: Partial<SupabaseAuthPort> = {}): SupabaseAuthPort {
  return {
    signUp: () => Promise.resolve(ok()),
    signInWithPassword: () => Promise.resolve(ok()),
    getUser: () => Promise.resolve(okUser()),
    signOut: () => Promise.resolve({ error: null }),
    ...over,
  };
}
function ok(): SupabaseAuthResponse {
  return {
    data: {
      user: { id: "11111111-1111-1111-1111-111111111111", email: "a@b.co", email_confirmed_at: "2026-01-01" },
      session: { access_token: "tok_123", expires_at: 1900000000 },
    },
    error: null,
  };
}
function okUser(): SupabaseUserResponse {
  return { data: { user: { id: "11111111-1111-1111-1111-111111111111", email: "a@b.co", email_confirmed_at: "x" } }, error: null };
}

describe("SupabaseAuthProvider", () => {
  it("signIn maps Supabase session to AuthSession", async () => {
    const p = new SupabaseAuthProvider({ client: fakePort() });
    const s = await p.signIn({ email: "A@B.co", password: "x" });
    expect(s.user.id).toBe("11111111-1111-1111-1111-111111111111");
    expect(s.user.emailVerified).toBe(true);
    expect(s.accessToken).toBe("tok_123");
    expect(s.expiresAt).toBe(1900000000 * 1000);
  });

  it("signIn throws Unauthorized on error", async () => {
    const p = new SupabaseAuthProvider({
      client: fakePort({ signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: "bad" } }) }),
    });
    await expect(p.signIn({ email: "a@b.co", password: "x" })).rejects.toThrow();
  });

  it("signUp throws Conflict on existing user", async () => {
    const p = new SupabaseAuthProvider({
      client: fakePort({ signUp: () => Promise.resolve({ data: { user: null, session: null }, error: { message: "exists", status: 422 } }) }),
    });
    await expect(p.signUp({ email: "a@b.co", password: "x" })).rejects.toThrow();
  });

  it("getSession returns null on invalid token", async () => {
    const p = new SupabaseAuthProvider({
      client: fakePort({ getUser: () => Promise.resolve({ data: { user: null }, error: { message: "invalid" } }) }),
    });
    expect(await p.getSession("nope")).toBeNull();
  });
});
