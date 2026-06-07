import { describe, expect, it } from "vitest";

import { buildCryptoConfig } from "./crypto-config.js";

describe("buildCryptoConfig", () => {
  it("parses coins and confirmations from env", () => {
    const c = buildCryptoConfig({ CRYPTO_SUPPORTED_COINS: "btc, usdt ,eth", CRYPTO_CONFIRMATIONS: "3" });
    expect(c.coins).toEqual(["BTC", "USDT", "ETH"]);
    expect(c.confirmations).toBe(3);
  });
  it("falls back to defaults", () => {
    const c = buildCryptoConfig({});
    expect(c.coins.length).toBeGreaterThan(0);
    expect(c.confirmations).toBe(2);
  });
  it("guards invalid confirmations", () => {
    expect(buildCryptoConfig({ CRYPTO_CONFIRMATIONS: "-5" }).confirmations).toBe(2);
  });
});
