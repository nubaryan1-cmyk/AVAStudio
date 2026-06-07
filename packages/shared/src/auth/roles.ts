import { ORG_ROLES, type OrgRole } from "../domain/enums.js";

/**
 * Ролевая модель организации (TASK 10.4). Иерархия: owner > admin > editor > viewer.
 * 2FA обязательна для owner/admin (enforced в permissions.assertCan).
 */

/** Ранг роли (выше = больше прав). */
export const ROLE_RANK: Record<OrgRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

/** Роли, для которых 2FA обязательна. */
export const ROLES_REQUIRING_2FA: readonly OrgRole[] = ["owner", "admin"];

export function isOrgRole(value: string): value is OrgRole {
  return (ORG_ROLES as readonly string[]).includes(value);
}

/** role не ниже минимальной. */
export function roleAtLeast(role: OrgRole, min: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** Требуется ли 2FA для данной роли. */
export function roleRequires2fa(role: OrgRole): boolean {
  return ROLES_REQUIRING_2FA.includes(role);
}
