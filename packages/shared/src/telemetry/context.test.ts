import { propagation, trace, context } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  currentTraceId,
  injectTraceContext,
  withExtractedContext,
  withSpan,
  type TraceCarrier,
} from "./context.js";

const exporter = new InMemorySpanExporter();
let provider: BasicTracerProvider;

beforeAll(() => {
  provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  trace.setGlobalTracerProvider(provider);
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
});

afterAll(async () => {
  await provider.shutdown();
});

const find = (name: string): ReadableSpan =>
  exporter.getFinishedSpans().find((s) => s.name === name)!;

describe("telemetry/context", () => {
  it("withSpan создаёт спан и выставляет OK", async () => {
    exporter.reset();
    const out = await withSpan("op", async () => 7);
    expect(out).toBe(7);
    expect(find("op").status.code).toBe(1); // OK
  });

  it("inject → extract связывает спаны в одно дерево (web→queue→worker)", async () => {
    exporter.reset();
    let carrier: TraceCarrier = {};
    let parentTraceId = "";

    // Producer (web): активный спан → инжект контекста в carrier (job data).
    await withSpan("web.enqueue", async () => {
      parentTraceId = currentTraceId() ?? "";
      carrier = injectTraceContext();
    });
    expect(carrier["traceparent"]).toBeTruthy();
    const parent = find("web.enqueue");

    // Consumer (worker): извлекаем контекст из carrier → дочерний спан.
    await withExtractedContext(carrier, async () => {
      await withSpan("worker.process", async () => undefined);
    });

    const child = find("worker.process");
    expect(child.spanContext().traceId).toBe(parent.spanContext().traceId);
    expect(child.spanContext().traceId).toBe(parentTraceId);
    expect(child.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
  });

  it("currentTraceId вне трейса возвращает undefined", () => {
    expect(currentTraceId()).toBeUndefined();
  });

  it("withSpan пробрасывает ошибку и помечает спан ERROR", async () => {
    exporter.reset();
    await expect(
      withSpan("fail", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(find("fail").status.code).toBe(2); // ERROR
  });
});
