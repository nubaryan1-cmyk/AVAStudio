import { describe, expect, it, vi } from "vitest";

import { Analytics, type AnalyticsSink } from "./analytics.js";
import { noopReporter, reportError, scrubReport } from "./error-reporter.js";
import { axiomTransportFromEnv } from "./log-context.js";
import { burnRate, errorBudget, SLOS } from "./slo.js";

describe("error reporter (24.1)", () => {
  it("scrubs secrets from context/extra", () => {
    const r = scrubReport(new Error("boom"), { userId: "u1", traceId: "t1" }, { password: "secret", note: "ok" });
    expect(r.message).toBe("boom");
    expect(r.context.userId).toBe("u1");
    expect(r.extra?.password).toBe("[REDACTED]");
    expect(r.extra?.note).toBe("ok");
  });
  it("reportError never throws", () => {
    const throwing = { capture: () => { throw new Error("sentry down"); } };
    expect(() => reportError(throwing, new Error("x"), {})).not.toThrow();
    expect(() => reportError(noopReporter, new Error("x"), {})).not.toThrow();
  });
});

describe("axiom transport (24.2)", () => {
  it("null without env, config with env", () => {
    expect(axiomTransportFromEnv({})).toBeNull();
    const c = axiomTransportFromEnv({ AXIOM_DATASET: "ds", AXIOM_TOKEN: "tk" });
    expect(c?.options.dataset).toBe("ds");
  });
});

describe("analytics consent (24.4)", () => {
  it("no tracking without consent", () => {
    const sink: AnalyticsSink = { capture: vi.fn(), identify: vi.fn() };
    const a = new Analytics({ consent: false, sink });
    a.track("signup", "u1");
    a.identify("u1");
    expect(sink.capture).not.toHaveBeenCalled();
    expect(sink.identify).not.toHaveBeenCalled();
  });
  it("tracks with consent", () => {
    const sink: AnalyticsSink = { capture: vi.fn(), identify: vi.fn() };
    const a = new Analytics({ consent: true, sink });
    a.track("post_published", "u1", { platform: "tiktok" });
    expect(sink.capture).toHaveBeenCalledOnce();
  });
});

describe("SLO burn-rate (24.5)", () => {
  it("errorBudget = 1 - target", () => {
    expect(errorBudget(SLOS.apiUptime)).toBeCloseTo(0.0005, 6);
  });
  it("alerts when burning fast", () => {
    const r = burnRate(SLOS.postingSuccess, { total: 100, errors: 20 });
    expect(r.alert).toBe(true);
    expect(r.budgetExhausted).toBe(true);
  });
  it("no alert within budget", () => {
    const r = burnRate(SLOS.postingSuccess, { total: 1000, errors: 10 });
    expect(r.alert).toBe(false);
  });
});
