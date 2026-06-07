import { createLogger, type OrgId } from "@avastudio/shared";
import {
  InMemoryAiUsageRepository,
  ProviderRateLimiter,
  createMockImageProvider,
  createMockTtsProvider,
  createMockVideoProvider,
  createRegistry,
} from "@avastudio/shared/ai";
import { describe, expect, it } from "vitest";

import { createAiAudioProcessor, createAiImageProcessor, createAiVideoProcessor } from "./ai.js";

import type { Job } from "bullmq";

const ORG = "11111111-1111-4111-8111-111111111111";
const silent = createLogger({ destination: { write: () => undefined } });

function fakeJob(data: unknown): Job {
  return { id: "job-1", data } as unknown as Job;
}

function ctx() {
  const registry = createRegistry({
    image: [createMockImageProvider({ name: "openai-image", fail: true }), createMockImageProvider({ name: "mock-image" })],
    video: [createMockVideoProvider({ name: "mock-video" })],
    audio: [createMockTtsProvider({ name: "mock-tts" })],
  });
  const usageRepo = new InMemoryAiUsageRepository();
  return { registry, usageRepo, rateLimiter: new ProviderRateLimiter(1000), logger: silent };
}

describe("AI processors (mock через очереди)", () => {
  it("ai-image: fallback на mock-image + запись cost", async () => {
    const c = ctx();
    const res = await createAiImageProcessor(c)(fakeJob({ orgId: ORG, prompt: "кот", size: "512x512" }));
    expect(res.provider).toBe("mock-image");
    expect(res.imageUrls).toHaveLength(1);
    const rows = await c.usageRepo.list(ORG as OrgId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.useCase).toBe("image");
  });

  it("ai-video: submit + запись cost", async () => {
    const c = ctx();
    const res = await createAiVideoProcessor(c)(fakeJob({ orgId: ORG, prompt: "волна", durationSec: 8 }));
    expect(res.state).toBe("queued");
    expect(res.jobId).toBeTruthy();
    expect((await c.usageRepo.list(ORG as OrgId))[0]?.useCase).toBe("video");
  });

  it("ai-audio: TTS + запись cost", async () => {
    const c = ctx();
    const res = await createAiAudioProcessor(c)(fakeJob({ orgId: ORG, prompt: "привет мир", voice: "ru-1" }));
    expect(res.audioUrl).toBeTruthy();
    expect((await c.usageRepo.list(ORG as OrgId))[0]?.useCase).toBe("audio");
  });
});
