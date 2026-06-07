import { describe, expect, it } from "vitest";

import {
  aggregateReferral,
  arpu,
  arr,
  cac,
  churnRate,
  inviteFromWaitlist,
  InMemoryWaitlistStore,
  joinWaitlist,
  ltv,
  ltvCacRatio,
  momGrowth,
  redeemInvite,
  referralCode,
  revshareAmount,
} from "./index.js";

describe("waitlist (26.1)", () => {
  it("join is idempotent, invite + redeem flow", async () => {
    const store = new InMemoryWaitlistStore();
    await joinWaitlist(store, "A@b.co");
    await joinWaitlist(store, "a@b.co");
    expect(store.size).toBe(1);
    const code = await inviteFromWaitlist(store, "a@b.co");
    expect(code).toHaveLength(8);
    const email = await redeemInvite(store, code);
    expect(email).toBe("a@b.co");
    await expect(redeemInvite(store, code)).rejects.toThrow(); // одноразовый
  });
  it("rejects invalid email", async () => {
    await expect(joinWaitlist(new InMemoryWaitlistStore(), "nope")).rejects.toThrow();
  });
});

describe("referral (26.4)", () => {
  it("code deterministic", () => {
    expect(referralCode("u1")).toBe(referralCode("u1"));
    expect(referralCode("u1")).not.toBe(referralCode("u2"));
  });
  it("revshare 10% default", () => {
    expect(revshareAmount(100)).toBe(10);
  });
  it("aggregates only active months", () => {
    const stats = aggregateReferral("u1", [
      { paymentUsd: 100, monthsSinceJoin: 1 },
      { paymentUsd: 100, monthsSinceJoin: 99 }, // вне durationMonths=12 → не считается
    ]);
    expect(stats.referredCount).toBe(2);
    expect(stats.totalEarnedUsd).toBe(10);
  });
});

describe("finance (26.5)", () => {
  it("arr = mrr*12", () => expect(arr(1000)).toBe(12000));
  it("churn rate %", () => expect(churnRate({ startCustomers: 200, churned: 10 })).toBe(5));
  it("arpu", () => expect(arpu({ mrrUsd: 1000, activeSubscribers: 50 })).toBe(20));
  it("ltv/cac health gate", () => {
    const v = ltv({ arpuUsd: 20, grossMargin: 0.8, monthlyChurnRate: 0.05 });
    const c = cac({ spendUsd: 1000, acquired: 20 });
    const r = ltvCacRatio(v, c);
    expect(r.healthy).toBe(true);
    expect(r.ratio).toBeGreaterThanOrEqual(3);
  });
  it("mom growth", () => expect(momGrowth(120, 100)).toBe(20));
});
