import { env } from "@avastudio/shared";
import { startTelemetry } from "@avastudio/shared/telemetry";

/**
 * Бутстрап трейсинга воркера (TASK 8.2). Импортируется ПЕРВЫМ в index.ts —
 * раньше @avastudio/queue/@avastudio/db, чтобы OTEL успел проинструментировать
 * http/pg до их загрузки. Включается флагом OTEL_TRACES_ENABLED=true.
 */
const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
startTelemetry({
  serviceName: "avastudio-worker",
  enabled: env.OTEL_TRACES_ENABLED === "true",
  ...(endpoint ? { otlpEndpoint: endpoint } : {}),
});
