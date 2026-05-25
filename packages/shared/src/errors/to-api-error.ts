import { ZodError } from "zod";

import { redact } from "../logger/redact.js";

import {
  AppError,
  DEFAULT_USER_MESSAGE,
  ERROR_STATUS,
  ValidationError,
  type ErrorCode,
} from "./app-error.js";

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    status: number;
    details?: Record<string, unknown>;
  };
}

/**
 * Преобразует ЛЮБУЮ ошибку в безопасный для клиента JSON.
 * Никогда не отдаёт internalMessage/stack/секреты. details маскируются redact'ом.
 * Неизвестные ошибки → generic INTERNAL 500.
 */
export function toApiError(error: unknown): ApiErrorBody {
  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.userMessage,
        status: error.httpStatus,
        ...(error.details ? { details: redact(error.details) } : {}),
      },
    };
  }
  return {
    error: {
      code: "INTERNAL",
      message: DEFAULT_USER_MESSAGE.INTERNAL,
      status: ERROR_STATUS.INTERNAL,
    },
  };
}

/** Строит ValidationError из ошибки Zod (безопасные details: путь + сообщение). */
export function validationErrorFromZod(error: ZodError): ValidationError {
  return new ValidationError({
    userMessage: DEFAULT_USER_MESSAGE.VALIDATION,
    internalMessage: error.message,
    details: {
      issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    },
  });
}
