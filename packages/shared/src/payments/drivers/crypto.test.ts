import { describe, expect, it } from "vitest";

import { asOrgId } from "../../domain/ids.js";
import { ExternalServiceError } from "../../errors/index.js";
import { money, type CheckoutPlanRef } from "../types.js";

import { CryptoInvoiceDriver, signCryptoIpn } from "./crypto.js";

const SECRET = "ipn_secret_test";
const FIXED = new Date("2026-05-30T12:00:00Z");
const driver = new CryptoInvoiceDriver({
  ipnSecret: SECRET,
  requiredConfirmations: 3,
  now: () => FIXED,
});

const plan: CheckoutPlanRef = {
  planId: "pro",
  providerPriceId: "n/a",
  amount: money("20.00", "USD", "fiat"),
  interval: "month",
};

describe("CryptoInvoiceDriver — тот же интерфейс, что и карты (TASK 9.4)", () => {
  it("capabilities: нет recurring/portal/refunds", () => {
    expect(driver.capabilities).toEqual({ recurring: false, portal: false, refunds: false });
  });

  it("createCheckout → invoice с адресом и суммой в крипте (конвертация фиат→крипта)", async () => {
    const cs = await driver.createCheckout(plan, { id: asOrgId("org-7") }, {
      preferredCurrency: "BTC",
    });
    expect(cs.provider).toBe("crypto");
    expect(cs.amount.kind).toBe("crypto");
    expect(cs.amount.currency).toBe("BTC");
    expect(cs.amount.amount).toBe("0.00050000"); // 20 * 0.000025
    expect(cs.cryptoAddress).toContain("addr_btc");
    expect(cs.cryptoNetwork).toBe("bitcoin");
    expect(cs.expiresAt).toBeInstanceOf(Date);
  });

  it("USDT-инвойс ≈ номиналу фиата", async () => {
    const cs = await driver.createCheckout(plan, { id: asOrgId("o") }, { preferredCurrency: "USDT" });
    expect(cs.amount.amount).toBe("20.00000000");
    expect(cs.cryptoNetwork).toBe("tron");
  });

  it("подписка через периодические invoice: renewal-хелперы", async () => {
    const sub = await driver.getSubscription("inv_1");
    expect(sub.status).toBe("active");
    const end = sub.currentPeriodEnd!;
    expect(driver.isRenewalDue(end, new Date(end.getTime() + 1000))).toBe(true);
    expect(driver.isRenewalDue(end, new Date(end.getTime() - 1000))).toBe(false);
    expect((await driver.cancelSubscription("inv_1")).status).toBe("canceled");
  });
});

describe("CryptoInvoiceDriver.parseWebhook (TASK 9.4)", () => {
  function ipn(body: Record<string, unknown>): { payload: string; sig: string } {
    const payload = JSON.stringify(body);
    return { payload, sig: signCryptoIpn(SECRET, payload) };
  }

  it("finished → payment_succeeded (нормализованное, как у карт)", async () => {
    const { payload, sig } = ipn({
      payment_id: "pay_1",
      payment_status: "finished",
      pay_amount: "0.0005",
      pay_currency: "btc",
      order_id: "org-7",
    });
    const evt = await driver.parseWebhook(payload, sig);
    expect(evt.id).toBe("pay_1");
    expect(evt.type).toBe("payment_succeeded");
    expect(evt.amount).toEqual({ amount: "0.0005", currency: "BTC", kind: "crypto" });
    expect(evt.orgId).toBe("org-7");
  });

  it("confirmed + достаточно подтверждений → payment_succeeded", async () => {
    const { payload, sig } = ipn({ payment_id: "p2", payment_status: "confirmed", confirmations: 3 });
    expect((await driver.parseWebhook(payload, sig)).type).toBe("payment_succeeded");
  });

  it("промежуточный статус (confirming) → отклоняется как не терминальный", async () => {
    const { payload, sig } = ipn({ payment_id: "p3", payment_status: "confirming", confirmations: 1 });
    await expect(driver.parseWebhook(payload, sig)).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it("expired → payment_failed", async () => {
    const { payload, sig } = ipn({ payment_id: "p4", payment_status: "expired" });
    expect((await driver.parseWebhook(payload, sig)).type).toBe("payment_failed");
  });

  it("неверная подпись отклоняется", async () => {
    const { payload } = ipn({ payment_id: "p5", payment_status: "finished" });
    await expect(driver.parseWebhook(payload, "deadbeef")).rejects.toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it("идемпотентность: один payload → один и тот же event.id", async () => {
    const { payload, sig } = ipn({ payment_id: "p_dup", payment_status: "finished" });
    const a = await driver.parseWebhook(payload, sig);
    const b = await driver.parseWebhook(payload, sig);
    expect(a.id).toBe(b.id);
  });
});
