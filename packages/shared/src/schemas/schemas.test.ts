import { describe, expect, expectTypeOf, it } from "vitest";

import {
  addSocialAccountSchema,
  captionSchemaFor,
  createOrgSchema,
  createPostingJobSchema,
  paginationSchema,
  planTierSchema,
  platformSchema,
} from "./index.js";

import type { Platform, PlanTier } from "../domain/enums.js";

describe("согласованность z.infer с domain", () => {
  it("platformSchema выводит ровно Platform", () => {
    expectTypeOf<ReturnType<typeof platformSchema.parse>>().toEqualTypeOf<Platform>();
    expectTypeOf<ReturnType<typeof planTierSchema.parse>>().toEqualTypeOf<PlanTier>();
    expect(platformSchema.parse("instagram")).toBe("instagram");
  });
});

describe("primitives", () => {
  it("platformSchema отклоняет неизвестную платформу", () => {
    expect(platformSchema.safeParse("facebook").success).toBe(false);
  });
  it("pagination проставляет дефолтный limit", () => {
    expect(paginationSchema.parse({}).limit).toBe(20);
  });
});

describe("createOrgSchema", () => {
  it("принимает валидные данные", () => {
    expect(createOrgSchema.safeParse({ name: "Acme", slug: "acme-1" }).success).toBe(true);
  });
  it("отклоняет slug с заглавными/пробелами и даёт сообщение", () => {
    const r = createOrgSchema.safeParse({ name: "Acme", slug: "Acme Inc" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/slug/);
  });
});

describe("addSocialAccountSchema", () => {
  it("валиден с платформой и username", () => {
    expect(addSocialAccountSchema.safeParse({ platform: "tiktok", username: "u" }).success).toBe(
      true,
    );
  });
  it("отклоняет пустой username", () => {
    expect(addSocialAccountSchema.safeParse({ platform: "tiktok", username: "" }).success).toBe(
      false,
    );
  });
});

describe("createPostingJobSchema", () => {
  it("coerce строки в дату для scheduledAt", () => {
    const r = createPostingJobSchema.parse({
      accountId: "00000000-0000-4000-8000-000000000001",
      assetId: "00000000-0000-4000-8000-000000000002",
      scheduledAt: "2026-06-01T10:00:00Z",
    });
    expect(r.scheduledAt).toBeInstanceOf(Date);
  });
});

describe("captionSchemaFor (платформо-специфично)", () => {
  it("X (280) отклоняет длинную подпись, instagram (2200) — принимает", () => {
    const long = "a".repeat(300);
    expect(captionSchemaFor("x").safeParse(long).success).toBe(false);
    expect(captionSchemaFor("instagram").safeParse(long).success).toBe(true);
  });
});
