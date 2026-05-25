/** Коды ошибок приложения и их HTTP-статусы. */
export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "PAYMENT_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "EXTERNAL_SERVICE"
  | "INTERNAL";

export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  EXTERNAL_SERVICE: 502,
  INTERNAL: 500,
};

/** Безопасные сообщения для пользователя по умолчанию (без internal-деталей). */
export const DEFAULT_USER_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION: "Проверьте корректность данных",
  UNAUTHORIZED: "Требуется вход",
  PAYMENT_REQUIRED: "Требуется оплата или превышен лимит тарифа",
  FORBIDDEN: "Недостаточно прав",
  NOT_FOUND: "Не найдено",
  CONFLICT: "Конфликт данных",
  RATE_LIMIT: "Слишком много запросов, попробуйте позже",
  EXTERNAL_SERVICE: "Внешний сервис временно недоступен",
  INTERNAL: "Внутренняя ошибка",
};

export interface AppErrorOptions {
  /** Безопасное сообщение для клиента. */
  userMessage?: string;
  /** Детальное сообщение для логов (НЕ отдаётся клиенту). */
  internalMessage?: string;
  /** Публичные детали (например, ошибки валидации) — маскируются перед отдачей. */
  details?: Record<string, unknown>;
  cause?: unknown;
  /** Ожидаемая (операционная) ошибка vs баг. */
  isOperational?: boolean;
}

/** Базовая ошибка приложения. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly userMessage: string;
  readonly internalMessage: string;
  readonly isOperational: boolean;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const internal = options.internalMessage ?? options.userMessage ?? code;
    super(internal);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = ERROR_STATUS[code];
    this.userMessage = options.userMessage ?? DEFAULT_USER_MESSAGE[code];
    this.internalMessage = internal;
    this.isOperational = options.isOperational ?? true;
    this.details = options.details;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(options?: AppErrorOptions) {
    super("VALIDATION", options);
  }
}
export class UnauthorizedError extends AppError {
  constructor(options?: AppErrorOptions) {
    super("UNAUTHORIZED", options);
  }
}
export class PaymentRequiredError extends AppError {
  constructor(options?: AppErrorOptions) {
    super("PAYMENT_REQUIRED", options);
  }
}
export class ForbiddenError extends AppError {
  constructor(options?: AppErrorOptions) {
    super("FORBIDDEN", options);
  }
}
export class NotFoundError extends AppError {
  constructor(options?: AppErrorOptions) {
    super("NOT_FOUND", options);
  }
}
export class ConflictError extends AppError {
  constructor(options?: AppErrorOptions) {
    super("CONFLICT", options);
  }
}
export class RateLimitError extends AppError {
  constructor(options?: AppErrorOptions) {
    super("RATE_LIMIT", options);
  }
}
export class ExternalServiceError extends AppError {
  constructor(options?: AppErrorOptions) {
    super("EXTERNAL_SERVICE", options);
  }
}
