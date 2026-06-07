import { describe, expect, it } from "vitest";

import { ExternalServiceError } from "../../errors/index.js";
import { asOrgId } from "../../domain/ids.js";
import { money, type CheckoutPlanRef } from "../types.js";

import { signStripePayload, StripeCardDriver } from "./stripe.js";

const SECRET = "whsec_test_123";
const FIXED = new Date("2026-05-30T12:00:00Z");
const driver = new StripeCardDriver({ webhookSecret: SECRET, now: () => FIXED });

const plan: CheckoutPlanRef = {
  planId: "pro",
  providerPriceId: "price_test_pro",
  amount: money("19.99", "USD", "fiat"),
  interval: "month",
};

function webhook(type: string, object: Record<string, unknown>, id = "evt_1"): string {
  return JSON.stringify({ id, type, created: Math.floor(FIXED.getTime() / 1000), data: { object } });
}

describe("StripeCardDriver — интерфейс (TASK 9.3)", () => {
  it("createCheckout в test-режиме возвращает session", async () => {
    const cs = await driver.createCheckout(plan, { id: asOrgId("org-9") }, {
      successUrl: "https://app/ok",
      idempotencyKey: "cs_idem_1",
    });
    expect(cs.id).toBe("cs_idem_1");
    expect(cs.provider).toBe("stripe");
    expect(cs.url).toContain("price_test_pro");
    expect(cs.url).toContain("org-9");
  });

  it("subscription lifecycle", async () => {
    expect((await driver.getSubscription("sub_1")).status).toBe("active");
    expect((await driver.cancelSubscription("sub_1")).status).toBe("canceled");
    expect((await driver.changePlan("sub_1", { ...plan, planId: "studio" })).planId).toBe("studio");
    expect((await driver.createPortalSession("cus_1")).url).toContain("cus_1");
  });
});

describe("StripeCardDriver.parseWebhook (TASK 9.3)", () => {
  it("проверяет подпись и нормализует checkout.session.completed → subscription_created", async () => {
    const payload = webhook("checkout.session.completed", {
      id: "sub_abc",
      subscription: "sub_abc",
      currency: "usd",
      amount_total: 1999,
      status: "active",
      metadata: { orgId: "org-9" },
      plan: { id: "price_test_pro" },
    });
    const sig = signStripePayload(SECRET, payload, Math.floor(FIXED.getTime() / 1000));
    const evt = await driver.parseWebhook(payload, sig);
    expect(evt.id).toBe("evt_1");
    expect(evt.type).toBe("subscription_created");
    expect(evt.providerSubscriptionId).toBe("sub_abc");
    expect(evt.planId).toBe("price_test_pro");
    expect(evt.orgId).toBe("org-9");
    expect(evt.amount).toEqual({ amount: "19.99", currency: "USD", kind: "fiat" });
  });

  it("invoice.payment_succeeded → payment_succeeded", async () => {
    const payload = webhook("invoice.payment_succeeded", { amount_paid: 4999, currency: "usd" });
    const sig = signStripePayload(SECRET, payload, Math.floor(FIXED.getTime() / 1000));
    const evt = await driver.parseWebhook(payload, sig);
    expect(evt.type).toBe("payment_succeeded");
    expect(evt.amount?.amount).toBe("49.99");
  });

  it("идемпотентность: один payload → одинаковый нормализованный id (дедуп в 9.5)", async () => {
    const payload = webhook("customer.subscription.deleted", { id: "sub_x" }, "evt_dup");
    const sig = signStripePayload(SECRET, payload, Math.floor(FIXED.getTime() / 1000));
    const a = await driver.parseWebhook(payload, sig);
    const b = await driver.parseWebhook(payload, sig);
    expect(a.id).toBe(b.id);
    expect(a.type).toBe("subscription_cancelled");
  });

  it("отклоняет неверную подпись", async () => {
    const payload = webhook("invoice.payment_failed", {});
    await expect(driver.parseWebhook(payload, "t=1,v1=deadbeef")).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it("отклоняет устаревшую подпись (анти-replay)", async () => {
    const payload = webhook("invoice.payment_succeeded", { amount_paid: 100, currency: "usd" });
    const sig = signStripePayload(SECRET, payload, 1_000_000); // далеко в прошлом
    await expect(driver.parseWebhook(payload, sig)).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
