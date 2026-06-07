import type { ObsContext } from "./error-reporter.js";
import type { Logger } from "../logger/logger.js";

/**
 * Привязка контекста к структурным логам (TASK 24.2). В каждый лог попадают
 * trace_id/request_id/user_id/org_id → поиск «все логи юзера X за час» в Axiom и
 * связка логов с трейсами (ЭТАП 8) по trace_id.
 */
export function bindLogContext(logger: Logger, ctx: ObsContext): Logger {
  const fields: Record<string, string> = {};
  if (ctx.traceId) fields["trace_id"] = ctx.traceId;
  if (ctx.requestId) fields["request_id"] = ctx.requestId;
  if (ctx.userId) fields["user_id"] = ctx.userId;
  if (ctx.orgId) fields["org_id"] = ctx.orgId;
  return logger.child(fields);
}

/** Конфиг транспорта Axiom (Pino). Используется при createLogger в проде. */
export interface AxiomTransport {
  target: "@axiomhq/pino";
  options: { dataset: string; token: string };
}

/** Строит конфиг Axiom-транспорта из env (null, если не настроен → stdout JSON). */
export function axiomTransportFromEnv(env: {
  AXIOM_DATASET?: string | undefined;
  AXIOM_TOKEN?: string | undefined;
}): AxiomTransport | null {
  if (!env.AXIOM_DATASET || !env.AXIOM_TOKEN) return null;
  return { target: "@axiomhq/pino", options: { dataset: env.AXIOM_DATASET, token: env.AXIOM_TOKEN } };
}
