import { describe, expect, it } from "vitest";

import { QUEUE_NAMES, DEFAULT_JOB_OPTIONS } from "./definitions.js";
import { validateJobData } from "./registry.js";

const ORG = "00000000-0000-4000-8000-000000000001";
const UUID = "00000000-0000-4000-8000-000000000002";

describe("реестр очередей", () => {
  it("определены все 12 очередей", () => {
    expect(QUEUE_NAMES).toHaveLength(13);
    expect(QUEUE_NAMES).toContain("render-video");
    expect(QUEUE_NAMES).toContain("send-email");
    expect(QUEUE_NAMES).toContain("ai-video");
  });

  it("дефолтные опции: 3 попытки + экспоненциальный backoff + очистка", () => {
    expect(DEFAULT_JOB_OPTIONS.attempts).toBe(3);
    expect(DEFAULT_JOB_OPTIONS.backoff).toEqual({ type: "exponential", delay: 5000 });
    expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toBe(1000);
    expect(DEFAULT_JOB_OPTIONS.removeOnFail).toBe(5000);
  });
});

describe("validateJobData (без Redis)", () => {
  it("принимает валидные данные render-video", () => {
    const data = validateJobData("render-video", {
      orgId: ORG,
      contentJobId: UUID,
      sourceAssetId: UUID,
    });
    expect(data.orgId).toBe(ORG);
  });

  it("отклоняет невалидные данные (не-uuid) с ошибкой валидации", () => {
    expect(() =>
      validateJobData("render-video", {
        orgId: "not-uuid",
        contentJobId: UUID,
        sourceAssetId: UUID,
      }),
    ).toThrow();
  });

  it("send-email требует валидный email", () => {
    expect(() => validateJobData("send-email", { to: "nope", template: "welcome" })).toThrow();
    expect(validateJobData("send-email", { to: "a@b.dev", template: "welcome" }).template).toBe(
      "welcome",
    );
  });

  it("ai-video отклоняет пустой prompt", () => {
    expect(() => validateJobData("ai-video", { orgId: ORG, prompt: "" })).toThrow();
  });

  it("unique-media ограничивает variants 1..100", () => {
    expect(() =>
      validateJobData("unique-media", { orgId: ORG, sourceAssetId: UUID, variants: 0 }),
    ).toThrow();
    expect(() =>
      validateJobData("unique-media", { orgId: ORG, sourceAssetId: UUID, variants: 101 }),
    ).toThrow();
    expect(
      validateJobData("unique-media", { orgId: ORG, sourceAssetId: UUID, variants: 50 }).variants,
    ).toBe(50);
  });
});
