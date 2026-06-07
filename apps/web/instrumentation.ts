/**
 * Next.js instrumentation hook (TASK 8.2). Стартует OpenTelemetry только в
 * Node-рантайме — трейсит серверные роуты/Server Actions (web-сторона дерева
 * web→queue→worker). Включается флагом OTEL_TRACES_ENABLED=true.
 */
export async function register(): Promise<void> {
  // eslint-disable-next-line no-process-env -- NEXT_RUNTIME — флаг рантайма Next, не секрет
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startTelemetry } = await import("@avastudio/shared/telemetry");
  const { env } = await import("@avastudio/shared");
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  startTelemetry({
    serviceName: "avastudio-web",
    enabled: env.OTEL_TRACES_ENABLED === "true",
    ...(endpoint ? { otlpEndpoint: endpoint } : {}),
  });
}
