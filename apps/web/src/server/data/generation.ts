import {
  createMockImageProvider,
  createMockMusicProvider,
  createMockTtsProvider,
  createRegistry,
  generateAudio,
  generateImage,
  generateMusic,
  type AiAsset,
} from "@avastudio/shared/ai";

import { addAsset, type MediaAssetRecord } from "./media.js";

/**
 * AI-Генерация (Фаза 1) — UI-обвязка над AI-реестром (ЭТАП 11).
 * Регистрируем mock-провайдеры (по 2 на use-case для fallback); реальные API — Фаза 2.
 * Результат сразу импортируется в медиатеку как ассет.
 */

const REGISTRY = createRegistry({
  image: [createMockImageProvider({ name: "mock-image" }), createMockImageProvider({ name: "mock-image-2" })],
  audio: [createMockTtsProvider({ name: "mock-tts" }), createMockTtsProvider({ name: "mock-tts-2" })],
  music: [createMockMusicProvider({ name: "mock-music" }), createMockMusicProvider({ name: "mock-music-2" })],
});

export type GenKind = "image" | "tts" | "music";

export interface GenResult {
  kind: GenKind;
  provider: string;
  latencyMs: number;
  asset: MediaAssetRecord;
}

function sizeFromAsset(a: AiAsset, fallback: number): number {
  return a.bytes ?? fallback;
}

export async function generateImageAsset(prompt: string): Promise<GenResult> {
  const res = await generateImage(REGISTRY, { prompt, size: "1024x1024", n: 1 });
  const img = res.value.images[0]!;
  const asset = addAsset({
    name: `ai-image-${Date.now()}.png`,
    type: "image",
    sizeBytes: sizeFromAsset(img, 1024 * 1024),
    durationSec: 0,
    width: img.width ?? 1024,
    height: img.height ?? 1024,
    tags: ["ai", "image"],
  });
  return { kind: "image", provider: res.value.meta.provider, latencyMs: res.value.meta.latencyMs, asset };
}

export async function generateTtsAsset(text: string): Promise<GenResult> {
  const res = await generateAudio(REGISTRY, { text, language: "ru" });
  const a = res.value.audio;
  const asset = addAsset({
    name: `ai-voice-${Date.now()}.wav`,
    type: "audio",
    sizeBytes: sizeFromAsset(a, Math.round((a.durationSec ?? 5) * 40_000)),
    durationSec: a.durationSec ?? 5,
    width: 0,
    height: 0,
    tags: ["ai", "voice"],
  });
  return { kind: "tts", provider: res.value.meta.provider, latencyMs: res.value.meta.latencyMs, asset };
}

export async function generateMusicAsset(prompt: string, durationSec: number): Promise<GenResult> {
  const res = await generateMusic(REGISTRY, { prompt, durationSec });
  const a = res.value.audio;
  const asset = addAsset({
    name: `ai-music-${Date.now()}.mp3`,
    type: "audio",
    sizeBytes: sizeFromAsset(a, Math.round((a.durationSec ?? durationSec) * 40_000)),
    durationSec: a.durationSec ?? durationSec,
    width: 0,
    height: 0,
    tags: ["ai", "music"],
  });
  return { kind: "music", provider: res.value.meta.provider, latencyMs: res.value.meta.latencyMs, asset };
}
