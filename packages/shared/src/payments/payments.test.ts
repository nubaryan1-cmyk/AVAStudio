import { describe, expect, it } from "vitest";

import { asOrgId } from "../domain/ids.js";
import { NotFoundError } from "../errors/index.js";

import { MockPaymentDriver } from "./mock-driver.js";
import { PaymentProviderRegistry, selectActiveProvider } from "./registry.js";
import { money, moneySchema, type CheckoutPlanRef } from "./types.js";

const plan: CheckoutPlanRef = {
  planId: "pro",
  providerPriceId: "price_123",
  amount: money("19.99", "USD", "fiat"),
  interval: "month",
};

describe("Money (TASK 9.1)", () => {
  it("поддерживает фиат и крипто", () => {
    expect(money("19.99", "USD", "fiat").kind).toBe("fiat");
    expect(money("0.00042100", "BTC", "crypto").currency).toBe("BTC");
  });

  it("отклоняет невалидную сумму", () => {
    expect(() => money("-1", "USD", "fiat")).toThrow();
    expect(moneySchema.safeParse({ amount: "abc", currency: "USD", kind: "fiat" }).success).toBe(
      false,
    );
  });
});

describe("Реестр провайдеров (TASK 9.1)", () => {
  it("регистрирует, отдаёт и перечисляет провайдеры", () => {
    const reg = new PaymentProviderRegistry().register(new MockPaymentDriver());
    expect(reg.has("stripe")).toBe(true);
    expect(reg.list()).toContain("stripe");
    expect(reg.get("stripe").capabilities.recurring).toBe(true);
  });

  it("get неизвестного провайдера → NotFoundError", () => {
    const reg = new PaymentProviderRegistry();
    expect(() => reg.get("crypto")).toThrow(NotFoundError);
  });

  it("selectActiveProvider: preferred и дефолт (первый)", () => {
    const reg = new PaymentProviderRegistry().register(new MockPaymentDriver());
    expect(selectActiveProvider(reg, "stripe").name).toBe("stripe");
    expect(selectActiveProvider(reg).name).toBe("stripe");
    expect(() => selectActiveProvider(new PaymentProviderRegistry())).toThrow(NotFoundError);
  });
});

describe("Mock-драйвер реализует интерфейс PaymentProvider (TASK 9.1)", () => {
  const driver = new MockPaymentDriver({ webhookSecret: "s3cret" });
  const org = { id: asOrgId("org-1") };

  it("createCheckout → CheckoutSession с суммой плана", async () => {
    const cs = await driver.createCheckout(plan, org, { successUrl: "https://app/ok" });
    expect(cs.provider).toBe("stripe");
    expect(cs.amount).toEqual(plan.amount);
    expect(cs.url).toContain("org-1");
  });

  it("subscription lifecycle: get/cancel/changePlan", async () => {
    expect((await driver.getSubscription("sub_1")).status).toBe("active");
    expect((await driver.cancelSubscription("sub_1")).status).toBe("canceled");
    expect((await driver.changePlan("sub_1", { ...plan, planId: "studio" })).planId).toBe("studio");
  });

  it("parseWebhook нормализует событие и проверяет подпись", async () => {
    const payload = JSON.stringify({
      id: "evt_1",
      type: "payment_succeeded",
      planId: "pro",
      orgId: "org-1",
    });
    const evt = await driver.parseWebhook(payload, "s3cret");
    expect(evt.id).toBe("evt_1");
    expect(evt.type).toBe("payment_succeeded");
    expect(evt.orgId).toBe("org-1");
    await expect(driver.parseWebhook(payload, "wrong")).rejects.toThrow();
  });
});
