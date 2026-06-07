import { describe, expect, it } from "vitest";

import { PaymentRequiredError } from "../errors/index.js";

import {
  assertWithinLimit,
  checkAction,
  checkLimit,
  getUsageVsLimit,
  type OrgEntitlementContext,
} from "./entitlements.js";
import {
  getPlan,
  planHasWatermark,
  PLANS,
  resolveProviderPriceId,
  type ProviderPriceMap,
} from "./plans.js";

describe("Планы (TASK 9.2)", () => {
  it("декларированы B2C и B2B с лимитами", () => {
    expect(PLANS.starter.tier).toBe("b2c");
    expect(PLANS.agency.tier).toBe("b2b");
    expect(getPlan("pro").limits.renders).toBe(300);
    expect(getPlan("enterprise").limits.accounts).toBeNull(); // безлимит
  });

  it("watermark-флаг связан (для TASK 6.7)", () => {
    expect(planHasWatermark("starter")).toBe(true);
    expect(planHasWatermark("pro")).toBe(false);
  });

  it("маппинг план↔price вынесен из ядра (конфиг)", () => {
    const map: ProviderPriceMap = { pro: { stripe: "price_live_pro" } };
    expect(resolveProviderPriceId(map, "pro", "stripe")).toBe("price_live_pro");
    expect(resolveProviderPriceId(map, "pro", "crypto")).toBeUndefined();
    expect(resolveProviderPriceId(map, "studio", "stripe")).toBeUndefined();
  });
});

describe("Лимиты / entitlements (TASK 9.2)", () => {
  const ctx: OrgEntitlementContext = { planId: "pro", usage: { renders: 299, accounts: 10 } };

  it("разрешает в пределах лимита", () => {
    const r = checkLimit(ctx, "renders", 1);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(1);
  });

  it("блокирует при превышении", () => {
    expect(checkLimit(ctx, "renders", 2).allowed).toBe(false);
    expect(checkLimit(ctx, "accounts", 1).allowed).toBe(false); // 10/10 уже занято
  });

  it("безлимит (enterprise) всегда разрешён", () => {
    const ent: OrgEntitlementContext = { planId: "enterprise", usage: { renders: 999999 } };
    const r = checkLimit(ent, "renders", 1000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBeNull();
  });

  it("апгрейд плана → новые лимиты", () => {
    const exceededPro = checkLimit({ planId: "pro", usage: { renders: 300 } }, "renders", 1);
    expect(exceededPro.allowed).toBe(false);
    const afterUpgrade = checkLimit({ planId: "studio", usage: { renders: 300 } }, "renders", 1);
    expect(afterUpgrade.allowed).toBe(true); // у studio лимит 1000
  });

  it("checkAction маппит действие на метрику", () => {
    expect(checkAction(ctx, "render", 1).metric).toBe("renders");
    expect(checkAction(ctx, "add_account", 1).metric).toBe("accounts");
  });

  it("assertWithinLimit бросает PaymentRequiredError при превышении", () => {
    expect(() => assertWithinLimit(ctx, "renders", 5)).toThrow(PaymentRequiredError);
    expect(() => assertWithinLimit(ctx, "renders", 1)).not.toThrow();
  });

  it("getUsageVsLimit считает долю", () => {
    const v = getUsageVsLimit(ctx, "renders");
    expect(v.limit).toBe(300);
    expect(v.used).toBe(299);
    expect(v.ratio).toBeCloseTo(299 / 300, 5);
  });
});
