import { describe, expect, it } from "vitest";

import { CryptoInvoiceDriver, signCryptoIpn } from "./drivers/crypto.js";
import { StripeCardDriver, signStripePayload } from "./drivers/stripe.js";
import { PaymentProviderRegistry } from "./registry.js";
import {
  InMemoryProcessedEventStore,
  InMemorySubscriptionStore,
  handleWebhook,
} from "./webhook-handler.js";

const NOW = new Date("2026-05-30T12:00:00.000Z");
const nowSec = Math.floor(NOW.getTime() / 1000);

function makeRegistry() {
  const registry = new PaymentProviderRegistry();
  registry.register(new StripeCardDriver({ webhookSecret: "whsec_test", now: () => NOW }));
  registry.register(new CryptoInvoiceDriver({ ipnSecret: "ipn_test", now: () => NOW }));
  return registry;
}

function deps() {
  return {
    registry: makeRegistry(),
    processed: new InMemoryProcessedEventStore(),
    subscriptions: new InMemorySubscriptionStore(),
  };
}

function cardPayload() {
  return JSON.stringify({
    id: "evt_card_1",
    type: "checkout.session.completed",
    created: nowSec,
    data: { object: { id: "sub_1", currency: "usd", amount_total: 1999, metadata: { orgId: "org_card" } } },
  });
}

function cryptoPayload() {
  return JSON.stringify({
    payment_id: "pay_crypto_1",
    payment_status: "finished",
    pay_amount: "0.0005",
    pay_currency: "btc",
    confirmations: 6,
    order_id: "org_crypto",
    created_at: NOW.toISOString(),
  });
}

describe("единый webhook-обработчик (TASK 9.5)", () => {
  it("обрабатывает событие карт → обновляет подписку", async () => {
    const d = deps();
    const payload = cardPayload();
    const sig = signStripePayload("whsec_test", payload, nowSec);
    const res = await handleWebhook(d, "stripe", payload, sig);
    expect(res.applied).toBe(true);
    expect(res.event.provider).toBe("stripe");
    expect(res.subscription?.orgId).toBe("org_card");
    expect(res.subscription?.status).toBe("active");
  });

  it("обрабатывает событие крипто тем же путём → обновляет подписку", async () => {
    const d = deps();
    const payload = cryptoPayload();
    const sig = signCryptoIpn("ipn_test", payload);
    const res = await handleWebhook(d, "crypto", payload, sig);
    expect(res.applied).toBe(true);
    expect(res.event.provider).toBe("crypto");
    expect(res.event.type).toBe("payment_succeeded");
    expect(res.subscription?.orgId).toBe("org_crypto");
  });

  it("карты и крипто дают одинаковую нормализацию (provider-agnostic)", async () => {
    const d = deps();
    const cp = cardPayload();
    const csig = signStripePayload("whsec_test", cp, nowSec);
    const card = await handleWebhook(d, "stripe", cp, csig);

    const yp = cryptoPayload();
    const ysig = signCryptoIpn("ipn_test", yp);
    const crypto = await handleWebhook(d, "crypto", yp, ysig);

    // одинаковая форма нормализованного события
    expect(Object.keys(card.event).sort()).toEqual(
      expect.arrayContaining(["id", "provider", "type", "occurredAt"]),
    );
    expect(Object.keys(crypto.event).sort()).toEqual(
      expect.arrayContaining(["id", "provider", "type", "occurredAt"]),
    );
    expect(typeof card.event.id).toBe("string");
    expect(typeof crypto.event.id).toBe("string");
  });

  it("идемпотентность: повторный webhook не дублирует (по event.id)", async () => {
    const d = deps();
    const payload = cardPayload();
    const sig = signStripePayload("whsec_test", payload, nowSec);
    const first = await handleWebhook(d, "stripe", payload, sig);
    const second = await handleWebhook(d, "stripe", payload, sig);
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(d.subscriptions.byOrg.size).toBe(1);
  });

  it("отклоняет неверную подпись", async () => {
    const d = deps();
    const payload = cardPayload();
    await expect(handleWebhook(d, "stripe", payload, "t=1,v1=bad")).rejects.toThrow();
  });
});
