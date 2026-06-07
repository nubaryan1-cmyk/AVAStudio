import { describe, expect, it } from "vitest";

import {
  AggregateAiError,
  createMockTtsProvider,
  createMockImageProvider,
  createMockMusicProvider,
  createMockVideoProvider,
  createRegistry,
  generateAudio,
  generateImage,
  generateMusic,
  runWithFallback,
  submitVideo,
  imageRequestSchema,
  videoRequestSchema,
} from "./index.js";

describe("runWithFallback", () => {
  it("использует первый успешный провайдер", async () => {
    const reg = createRegistry({ image: [createMockImageProvider({ name: "a" }), createMockImageProvider({ name: "b" })] });
    const res = await generateImage(reg, { prompt: "cat", n: 2 });
    expect(res.providerUsed).toBe("a");
    expect(res.value.images).toHaveLength(2);
    expect(res.attempts).toHaveLength(1);
  });

  it("переходит к следующему провайдеру при сбое", async () => {
    const reg = createRegistry({ image: [createMockImageProvider({ name: "x", fail: true }), createMockImageProvider({ name: "y" })] });
    const res = await generateImage(reg, { prompt: "dog" });
    expect(res.providerUsed).toBe("y");
    expect(res.attempts).toHaveLength(2);
    expect(res.attempts[0]?.ok).toBe(false);
    expect(res.attempts[1]?.ok).toBe(true);
  });

  it("кидает AggregateAiError если все провайдеры упали", async () => {
    const reg = createRegistry({ image: [createMockImageProvider({ name: "x", fail: true }), createMockImageProvider({ name: "z", fail: true })] });
    await expect(generateImage(reg, { prompt: "fail" })).rejects.toBeInstanceOf(AggregateAiError);
  });

  it("кидает RangeError на пустой цепочке", async () => {
    await expect(runWithFallback([], async () => 1)).rejects.toBeInstanceOf(RangeError);
  });
});

describe("video submit/poll (mock)", () => {
  it("submit отдаёт handle, poll — succeeded c результатом", async () => {
    const provider = createMockVideoProvider({ name: "vid", pollsUntilReady: 2 });
    const reg = createRegistry({ video: [provider] });
    const submitted = await submitVideo(reg, { prompt: "wave", durationSec: 10 });
    expect(submitted.value.state).toBe("queued");
    const first = await provider.pollVideo(submitted.value.jobId);
    expect(first.state).toBe("processing");
    const second = await provider.pollVideo(submitted.value.jobId);
    expect(second.state).toBe("succeeded");
    expect(second.video?.durationSec).toBe(10);
  });
});

describe("audio/music (mock)", () => {
  it("audio TTS возвращает ассет", async () => {
    const reg = createRegistry({ audio: [createMockTtsProvider()] });
    const res = await generateAudio(reg, { text: "привет мир" });
    expect(res.value.audio.mimeType).toBe("audio/wav");
  });

  it("music возвращает ассет с длительностью", async () => {
    const reg = createRegistry({ music: [createMockMusicProvider()] });
    const res = await generateMusic(reg, { prompt: "lofi", durationSec: 60 });
    expect(res.value.audio.durationSec).toBe(60);
  });
});

describe("schemas", () => {
  it("imageRequestSchema валидирует размер", () => {
    expect(imageRequestSchema.safeParse({ prompt: "x", size: "bad" }).success).toBe(false);
    expect(imageRequestSchema.safeParse({ prompt: "x", size: "512x512" }).success).toBe(true);
  });
  it("videoRequestSchema ограничивает длительность", () => {
    expect(videoRequestSchema.safeParse({ prompt: "x", durationSec: 120 }).success).toBe(false);
  });
});
