import { describe, expect, it } from "vitest";

import { verifyTurnstile, type TurnstileVerifier } from "./turnstile.js";

const okV: TurnstileVerifier = { verify: () => Promise.resolve({ success: true }) };
const failV: TurnstileVerifier = { verify: () => Promise.resolve({ success: false, errorCodes: ["invalid"] }) };

describe("Turnstile verify (TASK 23.3)", () => {
  it("passes valid token", async () => {
    expect(await verifyTurnstile(okV, { token: "t", secret: "s" })).toBe(true);
  });
  it("rejects invalid token", async () => {
    expect(await verifyTurnstile(failV, { token: "t", secret: "s" })).toBe(false);
  });
  it("rejects missing token when configured", async () => {
    expect(await verifyTurnstile(okV, { token: "", secret: "s" })).toBe(false);
  });
  it("unconfigured: allowed in dev, blocked when required", async () => {
    expect(await verifyTurnstile(okV, { token: null, secret: "" })).toBe(true);
    expect(await verifyTurnstile(okV, { token: null, secret: "" }, true)).toBe(false);
  });
});
