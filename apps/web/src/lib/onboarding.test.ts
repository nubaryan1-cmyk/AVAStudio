import { describe, expect, it } from "vitest";

import {
  ONBOARDING_STEPS,
  accountSchema,
  buildOnboardingResult,
  signUpSchema,
  stepProgress,
  workspaceSchema,
} from "./onboarding.js";

describe("онбординг: валидация форм (Zod)", () => {
  it("signup отклоняет несовпадающие пароли", () => {
    const r = signUpSchema.safeParse({
      email: "a@b.com",
      password: "longenough",
      confirmPassword: "different",
    });
    expect(r.success).toBe(false);
  });

  it("signup принимает валидные данные", () => {
    expect(
      signUpSchema.safeParse({ email: "a@b.com", password: "longenough", confirmPassword: "longenough" })
        .success,
    ).toBe(true);
  });

  it("workspace требует имя >= 2 символов", () => {
    expect(workspaceSchema.safeParse({ name: "x" }).success).toBe(false);
    expect(workspaceSchema.safeParse({ name: "Моя студия" }).success).toBe(true);
  });

  it("account валидирует площадку из enum", () => {
    expect(accountSchema.safeParse({ platform: "myspace", handle: "x" }).success).toBe(false);
    expect(accountSchema.safeParse({ platform: "tiktok", handle: "@b" }).success).toBe(true);
  });
});

describe("онбординг: создание org (user=owner)", () => {
  it("создатель становится владельцем", () => {
    const res = buildOnboardingResult({
      workspace: { name: "  Студия  " },
      account: { platform: "instagram", handle: "@brand" },
      plan: { planId: "pro" },
    });
    expect(res.ownerRole).toBe("owner");
    expect(res.org.name).toBe("Студия");
    expect(res.planId).toBe("pro");
    expect(res.firstAccount?.handle).toBe("@brand");
  });

  it("аккаунт можно пропустить", () => {
    const res = buildOnboardingResult({
      workspace: { name: "Студия" },
      account: null,
      plan: { planId: "starter" },
    });
    expect(res.firstAccount).toBeNull();
  });
});

describe("прогресс шагов", () => {
  it("3 шага → 33/67/100%", () => {
    expect(ONBOARDING_STEPS).toHaveLength(3);
    expect(stepProgress(0)).toBe(33);
    expect(stepProgress(1)).toBe(67);
    expect(stepProgress(2)).toBe(100);
  });
});
