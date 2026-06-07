import { describe, expect, it } from "vitest";

import {
  MetricsRegistry,
  renderPrometheus,
  type QueueObservation,
} from "./metrics.js";

describe("MetricsRegistry", () => {
  it("считает completed/failed, среднюю latency и fail rate", () => {
    const m = new MetricsRegistry();
    m.recordCompleted("render-video", 100);
    m.recordCompleted("render-video", 300);
    m.recordFailed("render-video");
    expect(m.completedTotal("render-video")).toBe(2);
    expect(m.failedTotal("render-video")).toBe(1);
    expect(m.avgLatencyMs("render-video")).toBe(200);
    expect(m.failRate("render-video")).toBeCloseTo(1 / 3, 5);
  });

  it("пустые очереди дают нули, без деления на ноль", () => {
    const m = new MetricsRegistry();
    expect(m.avgLatencyMs("x")).toBe(0);
    expect(m.failRate("x")).toBe(0);
  });
});

describe("renderPrometheus", () => {
  it("формирует валидный Prometheus-текст с глубиной/latency/fail rate/DLQ", () => {
    const m = new MetricsRegistry();
    m.recordCompleted("render-video", 1200);
    m.recordFailed("render-video");
    const obs: QueueObservation[] = [
      {
        queue: "render-video",
        counts: { waiting: 3, active: 1, delayed: 2, completed: 1, failed: 1 },
        dlqSize: 4,
      },
    ];
    const text = renderPrometheus(m, obs);
    expect(text).toContain("# TYPE avastudio_queue_depth gauge");
    expect(text).toContain('avastudio_queue_depth{queue="render-video"} 5'); // 3+2
    expect(text).toContain('avastudio_queue_active{queue="render-video"} 1');
    expect(text).toContain('avastudio_jobs_completed_total{queue="render-video"} 1');
    expect(text).toContain('avastudio_jobs_failed_total{queue="render-video"} 1');
    expect(text).toContain('avastudio_jobs_fail_rate{queue="render-video"} 0.5');
    expect(text).toContain('avastudio_job_latency_ms_avg{queue="render-video"} 1200');
    expect(text).toContain('avastudio_dlq_size{queue="render-video"} 4');
    expect(text.endsWith("\n")).toBe(true);
  });
});
