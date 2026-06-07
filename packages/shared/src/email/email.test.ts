import { describe, expect, it } from "vitest";

import { asOrgId } from "../domain/ids.js";

import { emailForEvent } from "./billing-events.js";
import { renderBillingEmail } from "./templates.js";

import type { NormalizedPaymentEvent } from "../payments/types.js";

describe("billing email", () => {
  it("renders payment_succeeded with amount", () => {
    const r = renderBillingEmail("payment_succeeded", { amount: "19.99", currency: "USD" });
    expect(r.subject).toContain("Платёж");
    expect(r.html).toContain("19.99");
    expect(r.text).toContain("USD");
  });

  it("escapes html in data", () => {
    const r = renderBillingEmail("welcome", { plan: "<script>" });
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("maps payment_succeeded event to email job", () => {
    const ev: NormalizedPaymentEvent = {
      id: "evt_1",
      provider: "stripe",
      type: "payment_succeeded",
      occurredAt: new Date(),
      amount: { amount: "19.99", currency: "USD", kind: "fiat" },
      orgId: asOrgId("11111111-1111-1111-1111-111111111111"),
    };
    const job = emailForEvent(ev);
    expect(job?.template).toBe("payment_succeeded");
    expect(job?.data.amount).toBe("19.99");
  });

  it("returns null for subscription_updated", () => {
    const ev: NormalizedPaymentEvent = { id: "e", provider: "stripe", type: "subscription_updated", occurredAt: new Date() };
    expect(emailForEvent(ev)).toBeNull();
  });
});
