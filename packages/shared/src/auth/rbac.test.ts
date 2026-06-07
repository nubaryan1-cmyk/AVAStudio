import { describe, expect, it } from "vitest";

import { assertCan, can, roleCan, PERMISSIONS, type Permission } from "./permissions.js";
import { roleAtLeast, roleRequires2fa, ROLE_RANK } from "./roles.js";

import type { OrgRole } from "../domain/enums.js";

const enabled = (role: OrgRole) => ({ role, totpEnabled: true });

describe("RBAC роли + права (TASK 10.4)", () => {
  it("иерархия ролей", () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(roleAtLeast("admin", "editor")).toBe(true);
    expect(roleAtLeast("viewer", "editor")).toBe(false);
  });

  it("viewer не может мутировать, но может читать", () => {
    expect(roleCan("viewer", "content.view")).toBe(true);
    expect(roleCan("viewer", "media.upload")).toBe(false);
    expect(roleCan("viewer", "post.publish")).toBe(false);
    expect(can({ role: "viewer", totpEnabled: true }, "content.create").allowed).toBe(false);
  });

  it("editor: контент/постинг да, аккаунты/биллинг нет", () => {
    expect(can(enabled("editor"), "post.publish").allowed).toBe(true);
    expect(can(enabled("editor"), "account.delete").allowed).toBe(false);
    expect(can(enabled("editor"), "billing.manage").allowed).toBe(false);
  });

  it("admin: управление аккаунтами да, биллинг/удаление org нет", () => {
    expect(can(enabled("admin"), "account.delete").allowed).toBe(true);
    expect(can(enabled("admin"), "billing.manage").allowed).toBe(false);
    expect(can(enabled("admin"), "org.delete").allowed).toBe(false);
  });

  it("owner: всё, включая биллинг и удаление org", () => {
    for (const action of Object.keys(PERMISSIONS) as Permission[]) {
      expect(can(enabled("owner"), action).allowed).toBe(true);
    }
  });

  it("2FA обязательна для owner/admin на мутирующих действиях", () => {
    expect(roleRequires2fa("owner")).toBe(true);
    expect(roleRequires2fa("editor")).toBe(false);
    // admin без 2FA — мутация заблокирована
    const d = can({ role: "admin", totpEnabled: false }, "account.delete");
    expect(d.allowed).toBe(false);
    expect(d.allowed === false && d.reason).toBe("2fa_required");
    // но чтение разрешено даже без 2FA
    expect(can({ role: "admin", totpEnabled: false }, "content.view").allowed).toBe(true);
    // editor без 2FA — мутация разрешена (2FA не обязательна)
    expect(can({ role: "editor", totpEnabled: false }, "post.publish").allowed).toBe(true);
  });

  it("assertCan: throw forbidden и 2fa_required", () => {
    expect(() => assertCan(enabled("viewer"), "media.upload")).toThrow();
    expect(() => assertCan({ role: "owner", totpEnabled: false }, "billing.manage")).toThrow();
    expect(() => assertCan(enabled("owner"), "billing.manage")).not.toThrow();
  });
});
