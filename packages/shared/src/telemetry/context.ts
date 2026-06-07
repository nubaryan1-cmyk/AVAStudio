import {
  SpanStatusCode,
  context,
  propagation,
  trace,
  type Attributes,
  type Span,
} from "@opentelemetry/api";

/** Носитель trace-контекста (W3C traceparent/tracestate), кладётся в job data. */
export type TraceCarrier = Record<string, string>;

const INVALID_TRACE_ID = "00000000000000000000000000000000";
const TRACER_NAME = "@avastudio/shared";

/**
 * Инжектит активный trace-контекст в carrier (для проброса через BullMQ job data):
 * producer вызывает перед постановкой задачи, кладёт результат в `job.data._otel`.
 */
export function injectTraceContext(carrier: TraceCarrier = {}): TraceCarrier {
  propagation.inject(context.active(), carrier);
  return carrier;
}

/**
 * Восстанавливает trace-контекст из carrier и выполняет `fn` в нём (consumer-сторона):
 * worker извлекает `job.data._otel` → спаны обработки становятся детьми web-спана,
 * формируя единое дерево web→queue→worker.
 */
export async function withExtractedContext<T>(
  carrier: TraceCarrier | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const ctx = propagation.extract(context.active(), carrier ?? {});
  return context.with(ctx, fn);
}

/** Trace-id активного спана (для ручной связки логов и трейсов). undefined вне трейса. */
export function currentTraceId(): string | undefined {
  const span = trace.getActiveSpan();
  const traceId = span?.spanContext().traceId;
  return traceId && traceId !== INVALID_TRACE_ID ? traceId : undefined;
}

/**
 * Выполняет `fn` внутри активного спана `name`: ставит OK/ERROR-статус,
 * записывает исключение и гарантированно закрывает спан.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Attributes,
): Promise<T> {
  const tracer = trace.getTracer(TRACER_NAME);
  return tracer.startActiveSpan(name, async (span) => {
    if (attributes) span.setAttributes(attributes);
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : String(error));
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
