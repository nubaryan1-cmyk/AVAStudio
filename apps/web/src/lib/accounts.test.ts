import { describe, expect, it } from "vitest";

import { createCaller } from "../server/routers/_app.js";

import { healthLevel, MECHANISM_LABELS, STATUS_LABELS } from "./accounts.js";

const caller = createCaller({});

describe("healthLevel", () => {
  it("классифицирует балл", () => {
    expect(healthLevel(90)).toBe("good");
    expect(healthLevel(60)).toBe("warning");
    expect(healthLevel(20)).toBe("bad");
  });
});

describe("accounts router", () => {
  it("list возвращает сиды и фильтрует по платформе", async () => {
    const all = await caller.accounts.list({});
    expect(all.length).toBeGreaterThan(0);

    const ig = await caller.accounts.list({ platform: "instagram" });
    expect(ig.every((a) => a.platform === "instagram")).toBe(true);
  });

  it("add: креды шифруются (плейнтекст не сохраняется) и аккаунт авторизован", async () => {
    const secret = "super-secret-token-123";
    const acc = await caller.accounts.add({
      platform: "tiktok",
      handle: "@new.acct",
      mechanism: "browser",
      secret,
    });

    expect(acc.status).toBe("authorized");
    expect(acc.sessionRef).toMatch(/^mock-/);
    // EncryptedBlob, а не открытый текст:
    expect(acc.encryptedCreds.v).toBe(1);
    expect(JSON.stringify(acc.encryptedCreds)).not.toContain(secret);
    expect(acc.log.some((l) => l.action.includes("зашифрованы"))).toBe(true);
    expect(acc.log.some((l) => l.action.includes("mock-драйвер"))).toBe(true);
  });

  it("привязка/отвязка телефона и прокси пишутся в лог", async () => {
    const acc = await caller.accounts.add({
      platform: "reddit",
      handle: "u/test_bindings",
      mechanism: "api",
      secret: "x",
    });

    const withPhone = await caller.accounts.bindPhone({ id: acc.id, phoneId: "phone_demo_1" });
    expect(withPhone.phoneId).toBe("phone_demo_1");
    expect(withPhone.log[0]?.action).toContain("телефон");

    const withProxy = await caller.accounts.bindProxy({ id: acc.id, proxyId: "proxy_demo_1" });
    expect(withProxy.proxyId).toBe("proxy_demo_1");

    const off = await caller.accounts.bindPhone({ id: acc.id, phoneId: null });
    expect(off.phoneId).toBeNull();
  });
});

describe("labels", () => {
  it("полны", () => {
    expect(STATUS_LABELS.authorized).toBeTruthy();
    expect(MECHANISM_LABELS.phone).toContain("PhonePool");
  });
});
