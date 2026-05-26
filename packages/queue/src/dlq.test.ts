import { describe, expect, it } from "vitest";

import {
  buildDeadLetterRecord,
  buildReplayJob,
  deadLetterQueueName,
  handleFailedJob,
  type DeadLetterRecord,
  type FailedJobLike,
} from "./dlq.js";

const job: FailedJobLike = {
  id: "job-1",
  name: "render",
  data: { assetId: "a1" },
  attemptsMade: 3,
  stacktrace: ["at x"],
  opts: { attempts: 3 },
};

describe("DLQ имена/записи", () => {
  it("deadLetterQueueName", () => {
    expect(deadLetterQueueName("render-video")).toBe("render-video-dlq");
  });
  it("buildDeadLetterRecord сохраняет данные/причину/стек", () => {
    const r = buildDeadLetterRecord("render-video", job, new Error("boom"));
    expect(r.originalQueue).toBe("render-video");
    expect(r.data).toEqual({ assetId: "a1" });
    expect(r.attemptsMade).toBe(3);
    expect(r.failedReason).toBe("boom");
    expect(r.stacktrace).toEqual(["at x"]);
    expect(r.failedAt).toMatch(/T.*Z$/);
  });
  it("buildReplayJob извлекает name+data", () => {
    const record: DeadLetterRecord = {
      originalQueue: "q",
      originalJobId: "1",
      name: "ping",
      data: { x: 1 },
      attemptsMade: 3,
      failedReason: "e",
      stacktrace: [],
      failedAt: "now",
    };
    expect(buildReplayJob(record)).toEqual({ name: "ping", data: { x: 1 } });
  });
});

describe("handleFailedJob (без Redis, fake sink)", () => {
  it("исчерпаны попытки → запись отправляется в sink (не теряется)", async () => {
    const captured: DeadLetterRecord[] = [];
    await handleFailedJob("render-video", job, new Error("boom"), async (r) => {
      captured.push(r);
    });
    expect(captured).toHaveLength(1);
    expect(captured[0]?.data).toEqual({ assetId: "a1" });
    expect(captured[0]?.attemptsMade).toBe(3);
  });

  it("попытки не исчерпаны → sink НЕ вызывается", async () => {
    const captured: DeadLetterRecord[] = [];
    const retrying: FailedJobLike = { ...job, attemptsMade: 1 };
    await handleFailedJob("render-video", retrying, new Error("boom"), async (r) => {
      captured.push(r);
    });
    expect(captured).toHaveLength(0);
  });
});
