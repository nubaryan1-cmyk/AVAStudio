import { describe, expect, it } from "vitest";

import { buildGoogleAuthUrl, exchangeCode, YOUTUBE_SCOPES, type TokenExchanger } from "./google.js";

describe("google oauth helpers", () => {
  it("builds consent url with offline access + scopes", () => {
    const url = buildGoogleAuthUrl({ clientId: "cid", redirectUri: "https://app/cb", state: "s1" });
    expect(url).toContain("client_id=cid");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain("state=s1");
    expect(decodeURIComponent(url)).toContain(YOUTUBE_SCOPES[0]);
  });

  it("exchanges code via port and normalizes tokens", async () => {
    const exchanger: TokenExchanger = {
      exchange: () => Promise.resolve({ accessToken: "at", refreshToken: "rt", expiresInSec: 3600 }),
    };
    const t = await exchangeCode(exchanger, { code: "c", clientId: "i", clientSecret: "s", redirectUri: "r" });
    expect(t.accessToken).toBe("at");
    expect(t.refreshToken).toBe("rt");
  });

  it("throws on empty access token", async () => {
    const exchanger: TokenExchanger = {
      exchange: () => Promise.resolve({ accessToken: "", expiresInSec: 0 }),
    };
    await expect(exchangeCode(exchanger, { code: "c", clientId: "i", clientSecret: "s", redirectUri: "r" })).rejects.toThrow();
  });
});
