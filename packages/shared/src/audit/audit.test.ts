import { describe, expect, it } from "vitest";

import { asOrgId, asUserId } from "../domain/ids.js";

import { audit, InMemoryAuditSink } from "./index.js";


const org = asOrgId("o1");
const user = asUserId("u1");

describe("audit log (TASK 23.4)", () => {
  it("records action with context", async () => {
    const sink = new InMemoryAuditSink();
    await audit(sink, "auth.login", { orgId: org, userId: user, ip: "1.2.3.4" });
    const rows = sink.query(org);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("auth.login");
    expect(rows[0]?.ip).toBe("1.2.3.4");
  });

  it("filters by action and user", async () => {
    const sink = new InMemoryAuditSink();
    await audit(sink, "auth.login", { orgId: org, userId: user });
    await audit(sink, "billing.subscribe", { orgId: org, userId: user, now: () => new Date(2026, 0, 2) });
    expect(sink.query(org, { action: "billing.subscribe" })).toHaveLength(1);
    expect(sink.query(org, { userId: "uX" })).toHaveLength(0);
  });

  it("does not throw when sink fails", async () => {
    const sink = { write: () => Promise.reject(new Error("db down")) };
    await expect(audit(sink, "auth.logout", { orgId: org, userId: user })).resolves.toBeUndefined();
  });

  it("org isolation", async () => {
    const sink = new InMemoryAuditSink();
    await audit(sink, "auth.login", { orgId: org, userId: user });
    expect(sink.query(asOrgId("other"))).toHaveLength(0);
  });
});
