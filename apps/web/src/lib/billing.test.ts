import { describe, expect, it } from "vitest";

import { createCaller } from "../server/routers/_app.js";

import { formatMoney, METRIC_LABELS, usageLevel } from "./billing.js";

const caller = createCaller({});

describe("billing helpers", () => {
  it("форматирует деньги", () => {
    expect(formatMoney({ amount: "19.99", currency: "USD", kind: "fiat" })).toBe("$19.99");
    expect(formatMoney({ amount: "0.5", currency: "USDC", kind: "crypto" })).toBe("0.5 USDC");
  });
  it("уровни использования", () => {
    expect(usageLevel(0.3)).toBe("good");
    expect(usageLevel(0.75)).toBe("warning");
    expect(usageLevel(0.95)).toBe("bad");
    expect(METRIC_LABELS.renders).toBeTruthy();
  });
});

describe("billing router", () => {
  it("state: тариф, лимиты, история, планы", async () => {
    const s = await caller.billing.state();
    expect(s.planName).toBe("Pro");
    expect(s.usage.length).toBeGreaterThan(0);
    expect(s.history.length).toBeGreaterThan(0);
    expect(s.availablePlans.some((p) => p.id === "studio")).toBe(true);
  });

  it("promo: валидный и невалидный код", async () => {
    const ok = await caller.billing.applyPromo({ code: "welcome20" });
    expect(ok.valid).toBe(true);
    expect(ok.discountPercent).toBe(20);
    const bad = await caller.billing.applyPromo({ code: "NOPE" });
    expect(bad.valid).toBe(false);
  });

  it("upgrade картой → mock-checkout URL", async () => {
    const co = await caller.billing.upgrade({ planId: "studio", method: "card" });
    expect(co.method).toBe("card");
    expect(co.url).toContain("checkout");
    expect(co.cryptoAddress).toBeNull();
  });

  it("upgrade криптой → адрес+сеть", async () => {
    const co = await caller.billing.upgrade({ planId: "studio", method: "crypto" });
    expect(co.method).toBe("crypto");
    expect(co.amount.kind).toBe("crypto");
    expect(co.cryptoAddress).toBeTruthy();
    expect(co.cryptoNetwork).toBe("polygon");
  });
});

describe("diagnostics", () => {
  it("checkpoint-аккаунт даёт проблему с инструкциями", async () => {
    const accounts = await caller.accounts.list({ platform: "reddit" });
    const checkpoint = accounts.find((a) => a.status === "checkpoint");
    expect(checkpoint).toBeDefined();
    const diag = await caller.billing.diagnose({ accountId: checkpoint!.id });
    expect(diag).not.toBeNull();
    expect(diag!.healthy).toBe(false);
    expect(diag!.problems.some((p) => p.code === "checkpoint")).toBe(true);
    expect(diag!.problems[0]!.steps.length).toBeGreaterThan(0);
  });
});
