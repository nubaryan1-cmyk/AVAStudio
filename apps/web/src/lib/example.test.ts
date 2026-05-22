import { describe, expect, it } from "vitest";

import { sum } from "./example";

describe("sum", () => {
  it("складывает числа", () => {
    expect(sum(10, 32)).toBe(42);
  });
});
