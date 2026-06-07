import { describe, expect, it } from "vitest";

import { asOrgId } from "../domain/ids.js";

import { reconcileSubscriptions, type LocalSubscriptionSource } from "./reconcile.js";
import { PaymentProviderRegistry } from "./registry.js";

import type { PaymentProvider } from "./types.js";


function driver(status: string, fail = false): PaymentProvider {
  return {
    name: "stripe",
    capabilities: { recurring: true, portal: true, refunds: true },
    createCheckout: () => Promise.reject(new Error("n/a")),
    getSubscription: (id) =>
      fail ? Promise.reject(new Error("gone")) : Promise.resolve({ id, status: status as never, planId: "pro", cancelAtPeriodEnd: false }),
    cancelSubscription: () => Promise.reject(new Error("n/a")),
    changePlan: () => Promise.reject(new Error("n/a")),
    parseWebhook: () => Promise.reject(new Error("n/a")),
  };
}

const org = asOrgId("11111111-1111-1111-1111-111111111111");

describe("reconcileSubscriptions", () => {
  it("no mismatch when statuses agree", async () => {
    const reg = new PaymentProviderRegistry().register(driver("active"));
    const local: LocalSubscriptionSource = {
      listActive: () => Promise.resolve([{ orgId: org, provider: "stripe", providerSubscriptionId: "sub_1", status: "active" }]),
    };
    const r = await reconcileSubscriptions(reg, local);
    expect(r.checked).toBe(1);
    expect(r.mismatches).toHaveLength(0);
  });

  it("flags status mismatch", async () => {
    const reg = new PaymentProviderRegistry().register(driver("canceled"));
    const local: LocalSubscriptionSource = {
      listActive: () => Promise.resolve([{ orgId: org, provider: "stripe", providerSubscriptionId: "sub_1", status: "active" }]),
    };
    const r = await reconcileSubscriptions(reg, local);
    expect(r.mismatches[0]?.providerStatus).toBe("canceled");
  });

  it("treats provider error as not_found mismatch", async () => {
    const reg = new PaymentProviderRegistry().register(driver("active", true));
    const local: LocalSubscriptionSource = {
      listActive: () => Promise.resolve([{ orgId: org, provider: "stripe", providerSubscriptionId: "sub_x", status: "active" }]),
    };
    const r = await reconcileSubscriptions(reg, local);
    expect(r.mismatches[0]?.providerStatus).toBe("not_found");
  });
});
