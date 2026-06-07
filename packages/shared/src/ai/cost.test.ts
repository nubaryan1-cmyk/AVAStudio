import { describe, expect, it } from "vitest";

import {
  InMemoryAiUsageRepository,
  ProviderRateLimiter,
  estimateCost,
} from "./cost.js";

import type { OrgId } from "../domain/ids.js";

const ORG = "11111111-1111-4111-8111-111111111111" as OrgId;

describe("estimateCost", () => {
  it("image: цена за изображение × output", () => {
    const cost = estimateCost({ provider: "openai-image", model: "gpt-image-1", inputSize: 0, outputSize: 2 });
    expect(cost.amount).toBe("0.080000");
    expect(cost.currency).toBe("USD");
  });
  it("video: цена за секунду × output", () => {
    const cost = estimateCost({ provider: "runway-video", model: "gen3a_turbo", inputSize: 0, outputSize: 10 });
    expect(cost.amount).toBe("0.500000");
  });
  it("tts: цена за 1k символов × input", () => {
    const cost = estimateCost({ provider: "elevenlabs-tts", model: "eleven_multilingual_v2", inputSize: 500, outputSize: 0 });
    expect(cost.amount).toBe("0.150000");
  });
  it("неизвестный провайдер → 0 USD", () => {
    const cost = estimateCost({ provider: "x", model: "y", inputSize: 100, outputSize: 1 });
    expect(cost.amount).toBe("0");
  });
  it("mock → 0", () => {
    expect(estimateCost({ provider: "mock-image", model: "mock-image-v1", inputSize: 0, outputSize: 4 }).amount).toBe("0.000000");
  });
});

describe("InMemoryAiUsageRepository", () => {
  it("пишет и агрегирует стоимость по org", async () => {
    const repo = new InMemoryAiUsageRepository();
    await repo.record({
      orgId: ORG, provider: "openai-image", model: "gpt-image-1", useCase: "image",
      inputSize: 0, outputSize: 1, estimatedCost: estimateCost({ provider: "openai-image", model: "gpt-image-1", inputSize: 0, outputSize: 1 }),
      latencyMs: 5, occurredAt: new Date(),
    });
    await repo.record({
      orgId: ORG, provider: "runway-video", model: "gen3a_turbo", useCase: "video",
      inputSize: 0, outputSize: 10, estimatedCost: estimateCost({ provider: "runway-video", model: "gen3a_turbo", inputSize: 0, outputSize: 10 }),
      latencyMs: 5, occurredAt: new Date(),
    });
    const rows = await repo.list(ORG);
    expect(rows).toHaveLength(2);
    expect(repo.totalUsd(ORG)).toBe("0.540000");
  });
});

describe("ProviderRateLimiter", () => {
  it("гейтит вызовы одного провайдера по минимальному интервалу", async () => {
    const limiter = new ProviderRateLimiter(50); // 50 rps → 20ms интервал
    const startedAt = Date.now();
    await limiter.run("p", async () => 1);
    await limiter.run("p", async () => 2);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(15);
  });
  it("пробрасывает результат", async () => {
    const limiter = new ProviderRateLimiter();
    await expect(limiter.run("p", async () => "ok")).resolves.toBe("ok");
  });
});
