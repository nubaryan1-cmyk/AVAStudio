import { describe, expect, it } from "vitest";

import {
  audioAssetToReplacementPath,
  createCartesiaProvider,
  createElevenLabsProvider,
  createMockMusicProvider,
  createMockTtsProvider,
  createSunoProvider,
} from "./index.js";

describe("mock TTS + music", () => {
  it("TTS возвращает аудио-ассет, длительность ~ длине текста", async () => {
    const res = await createMockTtsProvider().generateAudio({ text: "a".repeat(150), voice: "ru-1" });
    expect(res.audio.kind).toBe("audio");
    expect(res.audio.durationSec).toBe(10);
    expect(res.meta.useCase).toBe("audio");
  });
  it("музыка учитывает durationSec", async () => {
    const res = await createMockMusicProvider().generateMusic({ prompt: "lofi", durationSec: 45 });
    expect(res.audio.durationSec).toBe(45);
    expect(res.meta.useCase).toBe("music");
  });
  it("fail:true бросает", async () => {
    await expect(createMockTtsProvider({ fail: true }).generateAudio({ text: "x" })).rejects.toThrow();
  });
});

describe("каркасы реальных драйверов (Фаза 2)", () => {
  it("elevenlabs/cartesia без ключа неактивны", async () => {
    await expect(createElevenLabsProvider().generateAudio({ text: "x" })).rejects.toThrow(/ключ/);
    await expect(createCartesiaProvider().generateAudio({ text: "x" })).rejects.toThrow(/ключ/);
  });
  it("suno без ключа неактивен", async () => {
    await expect(createSunoProvider().generateMusic({ prompt: "x" })).rejects.toThrow(/ключ/);
  });
});

describe("интеграция с audioReplace", () => {
  it("файловый путь проходит", () => {
    expect(audioAssetToReplacementPath({ kind: "audio", url: "/tmp/a.mp3", mimeType: "audio/mpeg" })).toBe("/tmp/a.mp3");
  });
  it("data-URI отклоняется (нужна материализация)", () => {
    expect(() => audioAssetToReplacementPath({ kind: "audio", url: "data:audio/wav;base64,AA", mimeType: "audio/wav" })).toThrow();
  });
  it("не-аудио ассет отклоняется", () => {
    expect(() => audioAssetToReplacementPath({ kind: "image", url: "/x.png", mimeType: "image/png" })).toThrow();
  });
});
