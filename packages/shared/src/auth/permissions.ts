import { ForbiddenError } from "../errors/index.js";

import { roleRequires2fa } from "./roles.js";

import type { OrgRole } from "../domain/enums.js";

/**
 * Матрица прав RBAC (TASK 10.4): action → роли, которым он разрешён.
 * owner: всё (+ биллинг, удаление org). admin: управление + аккаунты. editor: контент + постинг.
 * viewer: только чтение (не присутствует ни в одном мутирующем действии).
 */

export const PERMISSIONS = {
  // Чтение — все роли.
  "content.view": ["owner", "admin", "editor", "viewer"],
  "analytics.view": ["owner", "admin", "editor", "viewer"],
  // Контент и постинг — editor и выше.
  "media.upload": ["owner", "admin", "editor"],
  "content.create": ["owner", "admin", "editor"],
  "content.edit": ["owner", "admin", "editor"],
  "post.publish": ["owner", "admin", "editor"],
  // Управление аккаунтами/командой — admin и выше.
  "account.add": ["owner", "admin"],
  "account.delete": ["owner", "admin"],
  "member.invite": ["owner", "admin"],
  "member.remove": ["owner", "admin"],
  // Биллинг и опасные действия — только owner.
  "audit.view": ["owner", "admin"],
  "billing.manage": ["owner"],
  "org.delete": ["owner"],
} as const satisfies Record<string, readonly OrgRole[]>;

export type Permission = keyof typeof PERMISSIONS;

/** Мутирующие действия (всё, кроме *.view). Для enforce-2FA owner/admin. */
function isMutating(action: Permission): boolean {
  return !action.endsWith(".view");
}

/** Субъект проверки: роль в организации + статус 2FA. */
export interface AccessSubject {
  role: OrgRole;
  totpEnabled: boolean;
}

/** Разрешено ли действие роли (без учёта 2FA). */
export function roleCan(role: OrgRole, action: Permission): boolean {
  return (PERMISSIONS[action] as readonly OrgRole[]).includes(role);
}

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: "forbidden" | "2fa_required" };

/**
 * Полное решение доступа: право роли + политика 2FA.
 * Для owner/admin мутирующие действия требуют включённой 2FA.
 */
export function can(subject: AccessSubject, action: Permission): AccessDecision {
  if (!roleCan(subject.role, action)) return { allowed: false, reason: "forbidden" };
  if (roleRequires2fa(subject.role) && isMutating(action) && !subject.totpEnabled) {
    return { allowed: false, reason: "2fa_required" };
  }
  return { allowed: true };
}

/** Guard: бросает ForbiddenError, если действие запрещено. */
export function assertCan(subject: AccessSubject, action: Permission): void {
  const decision = can(subject, action);
  if (decision.allowed) return;
  if (decision.reason === "2fa_required") {
    throw new ForbiddenError({
      userMessage: "Для этого действия требуется включить двухфакторную аутентификацию (2FA).",
      internalMessage: `2FA required: role=${subject.role} action=${action}`,
    });
  }
  throw new ForbiddenError({
    userMessage: "Недостаточно прав для выполнения действия.",
    internalMessage: `forbidden: role=${subject.role} action=${action}`,
  });
}
