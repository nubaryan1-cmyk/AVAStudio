import { describe, expect, it } from "vitest";

import { decryptJSON, generateDataKey } from "../credentials/index.js";
import { asOrgId, asSocialAccountId } from "../domain/ids.js";

import { createMockProxyProvider } from "./drivers/mock.js";
import { ProxyManager } from "./manager.js";
import { InMemoryProxyRepository } from "./repo.js";

import type { ProxyCredentials } from "./types.js";

const orgId = asOrgId("org-1");
const dek = generateDataKey();

function makeManager(...providers: ReturnType<typeof createMockProxyProvider>[]): {
  manager: ProxyManager;
  repo: InMemoryProxyRepository;
} {
  const repo = new InMemoryProxyRepository();
  const list = providers.length > 0 ? providers : [createMockProxyProvider({ name: "brightdata" })];
  return { manager: new ProxyManager(list, repo), repo };
}

describe("ProxyManager", () => {
  it("назначает аккаунту стабильный прокси (sticky): повторный assign = тот же IP", async () => {
    const { manager } = makeManager();
    const acc = asSocialAccountId("acc-1");
    const first = await manager.assign({ orgId, accountId: acc, dek, spec: { protocol: "http" } });
    const second = await manager.assign({ orgId, accountId: acc, dek });
    expect(second.id).toBe(first.id);
    expect(second.endpoint.host).toBe(first.endpoint.host);
  });

  it("разные аккаунты получают разные сессии/IP", async () => {
    const { manager } = makeManager();
    const a = await manager.assign({ orgId, accountId: asSocialAccountId("a"), dek });
    const b = await manager.assign({ orgId, accountId: asSocialAccountId("b"), dek });
    expect(a.id).not.toBe(b.id);
    expect(a.endpoint.host !== b.endpoint.host || a.endpoint.port !== b.endpoint.port).toBe(true);
  });

  it("креды прокси хранятся в зашифрованном виде (и расшифровываются обратно)", async () => {
    const { manager, repo } = makeManager();
    const acc = asSocialAccountId("acc-enc");
    const handle = await manager.assign({ orgId, accountId: acc, dek });
    const stored = await repo.findById(handle.id);
    expect(stored).toBeDefined();
    // В хранилище — EncryptedBlob, не открытый пароль.
    expect(stored?.encryptedCredentials.ct).toBeTruthy();
    expect(JSON.stringify(stored?.encryptedCredentials)).not.toContain("password");
    const creds = decryptJSON<ProxyCredentials>(stored!.encryptedCredentials, dek);
    expect(creds.username).toContain("brightdata");
    expect(typeof creds.password).toBe("string");
  });

  it("failover A→B когда первый провайдер недоступен", async () => {
    const { manager } = makeManager(
      createMockProxyProvider({ name: "brightdata", down: true }),
      createMockProxyProvider({ name: "iproyal" }),
    );
    const handle = await manager.assign({ orgId, accountId: asSocialAccountId("acc-f"), dek });
    expect(handle.provider).toBe("iproyal");
  });

  it("бросает, когда все провайдеры недоступны", async () => {
    const { manager } = makeManager(
      createMockProxyProvider({ name: "brightdata", down: true }),
      createMockProxyProvider({ name: "iproyal", down: true }),
    );
    await expect(
      manager.assign({ orgId, accountId: asSocialAccountId("acc-x"), dek }),
    ).rejects.toThrow(/нет доступных провайдеров/);
  });

  it("rotate выдаёт новый прокси и деактивирует старый", async () => {
    const { manager, repo } = makeManager();
    const acc = asSocialAccountId("acc-rot");
    const first = await manager.assign({ orgId, accountId: acc, dek });
    const rotated = await manager.rotate({ orgId, accountId: acc, dek });
    expect(rotated.id).not.toBe(first.id);
    expect(repo.activeCount).toBe(1);
    const old = await repo.findById(first.id);
    expect(old?.active).toBe(false);
  });

  it("recordResult обновляет reputation", async () => {
    const { manager, repo } = makeManager();
    const handle = await manager.assign({ orgId, accountId: asSocialAccountId("acc-rep"), dek });
    await manager.recordResult(handle.id, true);
    await manager.recordResult(handle.id, false);
    const stored = await repo.findById(handle.id);
    expect(stored?.reputation).toEqual({ success: 1, fail: 1 });
  });
});
