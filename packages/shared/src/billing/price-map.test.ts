import { describe, expect, it } from "vitest";

import { buildPriceMapFromEnv, missingPriceIds } from "./price-map.js";

describe("price-map from env", () => {
  it("builds map from STRIPE_PRICE_* and CRYPTO_PLAN_*", () => {
    const map = buildPriceMapFromEnv({
      STRIPE_PRICE_PRO: "price_live_pro",
      STRIPE_PRICE_STUDIO: "price_live_studio",
      CRYPTO_PLAN_PRO: "crypto_pro",
    });
    expect(map.pro?.stripe).toBe("price_live_pro");
    expect(map.studio?.stripe).toBe("price_live_studio");
    expect(map.pro?.crypto).toBe("crypto_pro");
    expect(map.studio?.crypto).toBeUndefined();
  });

  it("skips empty values", () => {
    const map = buildPriceMapFromEnv({ STRIPE_PRICE_PRO: "  ", STRIPE_PRICE_TEAM: "" });
    expect(map.pro).toBeUndefined();
    expect(map.team).toBeUndefined();
  });

  it("reports missing price ids (excluding free starter)", () => {
    const map = buildPriceMapFromEnv({ STRIPE_PRICE_PRO: "price_live_pro" });
    const missing = missingPriceIds(map, "stripe");
    expect(missing).toContain("studio");
    expect(missing).not.toContain("starter");
    expect(missing).not.toContain("pro");
  });
});
