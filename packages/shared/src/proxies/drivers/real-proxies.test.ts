import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { asOrgId, asSocialAccountId } from "../../domain/ids.js";
import { ProxyManager } from "../manager.js";
import { InMemoryProxyRepository } from "../repo.js";

import { createBrightDataProvider } from "./brightdata.js";
import { createIPRoyalProvider } from "./iproyal.js";


describe("real proxy drivers (TASK 22.3)", () => {
  it("brightdata: sticky session encodes session+geo in username", async () => {
    const p = createBrightDataProvider({ username: "brd-customer-x-zone-residential", password: "pw" });
    const s = await p.acquireSticky({ protocol: "http", region: "US" });
    expect(s.credentials.username).toContain("-session-");
    expect(s.credentials.username).toContain("-country-us");
    expect(s.endpoint.host).toBe("brd.superproxy.io");
  });

  it("iproyal: sticky encoded in password", async () => {
    const p = createIPRoyalProvider({ username: "user", password: "pw" });
    const s = await p.acquireSticky({ protocol: "http" });
    expect(s.credentials.password).toContain("_session-");
    expect(s.credentials.username).toBe("user");
  });

  it("isHealthy false without creds", async () => {
    expect(await createBrightDataProvider({}).isHealthy()).toBe(false);
    expect(await createIPRoyalProvider({}).isHealthy()).toBe(false);
  });

  it("ProxyManager assigns sticky + failover brightdata→iproyal", async () => {
    const repo = new InMemoryProxyRepository();
    // brightdata без кредов → unhealthy → failover на iproyal.
    const mgr = new ProxyManager(
      [createBrightDataProvider({}), createIPRoyalProvider({ username: "u", password: "p" })],
      repo,
    );
    const dek = new Uint8Array(randomBytes(32));
    const handle = await mgr.assign({ orgId: asOrgId("o1"), accountId: asSocialAccountId("a1"), dek });
    expect(handle.provider).toBe("iproyal");
    // sticky: повторный assign возвращает ту же привязку.
    const again = await mgr.assign({ orgId: asOrgId("o1"), accountId: asSocialAccountId("a1"), dek });
    expect(again.id).toBe(handle.id);
  });
});
