import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { PinoInstrumentation } from "@opentelemetry/instrumentation-pino";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";

/** Опции инициализации OpenTelemetry (значения берутся из env в точке старта). */
export interface TelemetryOptions {
  /** Имя сервиса в Jaeger (например, "avastudio-worker" / "avastudio-web"). */
  serviceName: string;
  /** Версия сервиса. По умолчанию "0.0.0". */
  serviceVersion?: string;
  /** OTLP/HTTP endpoint Jaeger. По умолчанию http://localhost:4318. */
  otlpEndpoint?: string;
  /** Выключатель: при false трейсинг не стартует (CI/тесты без Jaeger). */
  enabled?: boolean;
}

const DEFAULT_OTLP_ENDPOINT = "http://localhost:4318";

let sdk: NodeSDK | null = null;

/**
 * Запускает OpenTelemetry Node SDK (TASK 8.2). Экспорт спанов — по OTLP/HTTP в
 * локальный Jaeger. Авто-инструментирование HTTP, Postgres (pg) и Pino
 * (trace_id/span_id автоматически попадают в логи). Идемпотентна: повторный
 * вызов игнорируется. Вызывать как можно раньше при старте процесса.
 */
export function startTelemetry(options: TelemetryOptions): void {
  if (options.enabled === false) return;
  if (sdk) return;

  const endpoint = options.otlpEndpoint ?? DEFAULT_OTLP_ENDPOINT;
  const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: options.serviceVersion ?? "0.0.0",
    }),
    traceExporter,
    instrumentations: [
      new HttpInstrumentation(),
      new PgInstrumentation(),
      new PinoInstrumentation(),
    ],
  });

  sdk.start();
}

/** Корректно завершает SDK (flush спанов). Вызывать на graceful shutdown. */
export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = null;
}

/** Истина, если трейсинг инициализирован (для health/диагностики). */
export function isTelemetryStarted(): boolean {
  return sdk !== null;
}
