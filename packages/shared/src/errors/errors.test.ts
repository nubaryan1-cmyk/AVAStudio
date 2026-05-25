import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  AppError,
  ERROR_STATUS,
  ForbiddenError,
  NotFoundError,
  PaymentRequiredError,
  RateLimitError,
  ValidationError,
} from "./app-error.js";
import { toApiError, validationErrorFromZod } from "./to-api-error.js";

describe("AppError + подклассы", () => {
  it("подклассы проставляют код и HTTP-статус", () => {
    expect(new NotFoundError().code).toBe("NOT_FOUND");
    expect(new NotFoundError().httpStatus).toBe(404);
    expect(new ForbiddenError().httpStatus).toBe(403);
    expect(new RateLimitError().httpStatus).toBe(429);
    expect(new PaymentRequiredError().httpStatus).toBe(402);
  });
  it("instanceof работает через иерархию", () => {
    const e = new ValidationError();
    expect(e).toBeInstanceOf(AppError);
    expect(e).toBeInstanceOf(Error);
  });
  it("маппинг кодов ↔ статусов корректен", () => {
    expect(ERROR_STATUS.VALIDATION).toBe(400);
    expect(ERROR_STATUS.UNAUTHORIZED).toBe(401);
    expect(ERROR_STATUS.EXTERNAL_SERVICE).toBe(502);
    expect(ERROR_STATUS.INTERNAL).toBe(500);
  });
});

describe("toApiError — без утечки internal/секретов", () => {
  it("AppError → безопасное тело без internalMessage/stack", () => {
    const e = new ValidationError({
      userMessage: "Проверьте поля",
      internalMessage: "secret token=abc123 leaked detail",
    });
    const body = toApiError(e);
    expect(body.error.code).toBe("VALIDATION");
    expect(body.error.message).toBe("Проверьте поля");
    expect(body.error.status).toBe(400);
    const json = JSON.stringify(body);
    expect(json).not.toContain("abc123");
    expect(json).not.toContain("internalMessage");
    expect(json).not.toContain("stack");
  });

  it("details маскируются redact'ом", () => {
    const e = new ValidationError({
      details: { field: "email", password: "p@ss", apiKey: "sk-123" },
    });
    const body = toApiError(e);
    expect(body.error.details?.field).toBe("email");
    expect(body.error.details?.password).toBe("[REDACTED]");
    expect(body.error.details?.apiKey).toBe("[REDACTED]");
  });

  it("неизвестная ошибка → generic INTERNAL 500 без утечки сообщения", () => {
    const body = toApiError(new Error("internal db dsn postgres://user:pass@host"));
    expect(body.error.code).toBe("INTERNAL");
    expect(body.error.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("postgres://");
  });
});

describe("validationErrorFromZod", () => {
  it("строит ValidationError с безопасными issue-деталями", () => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse({ email: "nope" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const e = validationErrorFromZod(parsed.error);
      expect(e.code).toBe("VALIDATION");
      const body = toApiError(e);
      expect(Array.isArray(body.error.details?.issues)).toBe(true);
    }
  });
});
