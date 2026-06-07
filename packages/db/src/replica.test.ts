import { describe, expect, it } from "vitest";

import { pickDbRole } from "./replica.js";

describe("db role routing (25.3)", () => {
  it("writes go to primary", () => {
    expect(pickDbRole({ hasReplica: true }, { readonly: false })).toBe("primary");
  });
  it("analytical reads go to replica", () => {
    expect(pickDbRole({ hasReplica: true }, { readonly: true, analytical: true })).toBe("replica");
  });
  it("read-after-write stays on primary", () => {
    expect(pickDbRole({ hasReplica: true }, { readonly: true, requireFresh: true })).toBe("primary");
  });
  it("no replica configured → always primary", () => {
    expect(pickDbRole({ hasReplica: false }, { readonly: true, analytical: true })).toBe("primary");
  });
});
