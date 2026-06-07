import { describe, expect, it } from "vitest";

import { DEFAULT_FLAGS, resolveFlag } from "./feature-flags.js";

describe("feature-flags: resolveFlag", () => {
  it("returns the raw value when type matches default", () => {
    expect(resolveFlag("maintenanceMode", true)).toBe(true);
    expect(resolveFlag("signupEnabled", false)).toBe(false);
  });

  it("falls back to default on type mismatch", () => {
    expect(resolveFlag("maintenanceMode", "yes")).toBe(DEFAULT_FLAGS.maintenanceMode);
    expect(resolveFlag("signupEnabled", 1)).toBe(DEFAULT_FLAGS.signupEnabled);
  });

  it("falls back to default on undefined (key missing in store)", () => {
    expect(resolveFlag("maintenanceMode", undefined)).toBe(false);
  });
});
