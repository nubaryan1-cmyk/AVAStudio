import { describe, expect, it } from "vitest";

import { decideTargetMachines } from "./scale.js";

const opts = { min: 1, max: 10, jobsPerMachine: 50 };

describe("decideTargetMachines", () => {
  it("keeps min when queue is empty/low", () => {
    expect(decideTargetMachines(0, opts)).toEqual({ target: 1, reason: "min" });
    expect(decideTargetMachines(40, opts)).toEqual({ target: 1, reason: "min" });
  });
  it("scales up proportionally to backlog", () => {
    expect(decideTargetMachines(120, opts)).toEqual({ target: 3, reason: "scale" });
    expect(decideTargetMachines(101, opts)).toEqual({ target: 3, reason: "scale" });
  });
  it("clamps at max", () => {
    expect(decideTargetMachines(100000, opts)).toEqual({ target: 10, reason: "max" });
  });
  it("never goes below zero for negative input", () => {
    expect(decideTargetMachines(-5, opts)).toEqual({ target: 1, reason: "min" });
  });
});
