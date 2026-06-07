
import { PLAN_IDS, type PlanId } from "@avastudio/shared/billing";
import { PLATFORMS } from "@avastudio/shared/domain";
import { z } from "zod";

import type { OrgRole } from "@avastudio/shared/domain";

/** Учётные данные. */
export const signUpSchema = z
  .object({
    email: z.string().email("Введите корректный email"),
    password: z.string().min(8, "Минимум 8 символов"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Пароли не совпадают",
    path: ["confirmPassword"],
  });
export type SignUpValues = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(1, "Введите пароль"),
});
export type SignInValues = z.infer<typeof signInSchema>;

/** Шаг 1: рабочее пространство (организация). */
export const workspaceSchema = z.object({
  name: z.string().min(2, "Минимум 2 символа").max(60, "Максимум 60 символов"),
});
export type WorkspaceValues = z.infer<typeof workspaceSchema>;

/** Шаг 2: первый соц-аккаунт (можно пропустить). */
export const accountSchema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().min(1, "Укажите имя аккаунта").max(64),
});
export type AccountValues = z.infer<typeof accountSchema>;

/** Шаг 3: тариф/триал. */
export const planSchema = z.object({
  planId: z.enum(PLAN_IDS),
});
export type PlanValues = z.infer<typeof planSchema>;

export const ONBOARDING_STEPS = [
  { id: "workspace", title: "Рабочее пространство" },
  { id: "account", title: "Первый аккаунт" },
  { id: "plan", title: "Тариф" },
] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export interface OnboardingResult {
  org: { name: string };
  /** Создатель рабочего пространства становится владельцем. */
  ownerRole: OrgRole;
  firstAccount: AccountValues | null;
  planId: PlanId;
}

/**
 * Собирает результат онбординга. Создатель org = owner (RBAC, ЭТАП 10.4).
 * Фаза 1: чистая функция без реального персиста.
 */
export function buildOnboardingResult(input: {
  workspace: WorkspaceValues;
  account: AccountValues | null;
  plan: PlanValues;
}): OnboardingResult {
  return {
    org: { name: input.workspace.name.trim() },
    ownerRole: "owner",
    firstAccount: input.account,
    planId: input.plan.planId,
  };
}

export function stepProgress(stepIndex: number): number {
  return Math.round(((stepIndex + 1) / ONBOARDING_STEPS.length) * 100);
}
