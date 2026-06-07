import { describe, expect, it } from "vitest";

import {
  FEATURES,
  FORBIDDEN_TERMS,
  HERO,
  SOCIAL_PROOF,
  formatPlanPrice,
  planHighlights,
  pricingPlans,
} from "./marketing.js";

function allCopy(): string {
  const parts: string[] = [
    HERO.title,
    HERO.subtitle,
    HERO.primaryCta,
    HERO.secondaryCta,
    SOCIAL_PROOF.title,
    ...SOCIAL_PROOF.stats.map((s) => s.label),
    ...FEATURES.flatMap((f) => [f.title, f.description]),
  ];
  return parts.join(" ").toLowerCase();
}

describe("маркетинг-контент: нейтральные формулировки", () => {
  it("не содержит запрещённых терминов (риск эквайера)", () => {
    const words = allCopy().match(/[\p{L}-]+/gu) ?? [];
    for (const term of FORBIDDEN_TERMS) {
      const hit = words.some((w) => w.startsWith(term.toLowerCase()));
      expect(hit).toBe(false);
    }
  });
});

describe("pricing из движка тарифов", () => {
  it("витрина содержит все 6 планов из billing/plans.ts", () => {
    expect(pricingPlans().map((p) => p.id)).toEqual([
      "starter",
      "pro",
      "studio",
      "team",
      "agency",
      "enterprise",
    ]);
  });

  it("starter — бесплатно, enterprise — индивидуально, pro — цена/мес", () => {
    const byId = Object.fromEntries(pricingPlans().map((p) => [p.id, p]));
    expect(formatPlanPrice(byId.starter!)).toBe("Бесплатно");
    expect(formatPlanPrice(byId.enterprise!)).toBe("Индивидуально");
    expect(formatPlanPrice(byId.pro!)).toBe("$19.99/мес");
  });

  it("highlights отражают лимиты плана", () => {
    const pro = pricingPlans().find((p) => p.id === "pro")!;
    const hl = planHighlights(pro);
    expect(hl.some((h) => h.includes("Аккаунтов: 10"))).toBe(true);
    expect(hl).toContain("Без водяного знака");
  });
});
