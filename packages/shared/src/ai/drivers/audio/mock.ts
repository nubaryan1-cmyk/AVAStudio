/**
 * Mock audio-драйверы (Фаза 1, TASK 11.4): TTS (createMockTtsProvider, реализует
 * AudioProvider) и музыка (createMockMusicProvider, реализует MusicProvider).
 * Возвращают тестовый аудио-ассет без сети/ключей. Реальные — ./elevenlabs.ts,
 * ./cartesia.ts (TTS), ./suno.ts (музыка) — Фаза 2.
 */
import type {
  AudioProvider,
  AudioRequest,
  AudioResult,
  MusicProvider,
  MusicRequest,
} from "../../types.js";

export interface MockAudioOptions {
  name?: string;
  delayMs?: number;
  fail?: boolean;
}

const SILENT_WAV_FIXTURE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

/** Mock TTS-провайдер. Длительность ~ длина текста. */
export function createMockTtsProvider(options: MockAudioOptions = {}): AudioProvider {
  const name = options.name ?? "mock-tts";
  return {
    name,
    useCase: "audio",
    async generateAudio(req: AudioRequest): Promise<AudioResult> {
      const startedAt = Date.now();
      if (options.delayMs !== undefined && options.delayMs > 0) {
        await new Promise((r) => setTimeout(r, options.delayMs));
      }
      if (options.fail === true) {
        throw new Error(`${name}: симулированный сбой TTS`);
      }
      const durationSec = Math.max(1, Math.round(req.text.length / 15));
      return {
        audio: { kind: "audio", url: SILENT_WAV_FIXTURE, mimeType: "audio/wav", durationSec },
        meta: { provider: name, model: `${name}-v1`, useCase: "audio", latencyMs: Date.now() - startedAt },
      };
    },
  };
}

/** Mock music-провайдер. */
export function createMockMusicProvider(options: MockAudioOptions = {}): MusicProvider {
  const name = options.name ?? "mock-music";
  return {
    name,
    useCase: "music",
    async generateMusic(req: MusicRequest): Promise<AudioResult> {
      const startedAt = Date.now();
      if (options.fail === true) {
        throw new Error(`${name}: симулированный сбой music`);
      }
      const durationSec = req.durationSec ?? 30;
      return {
        audio: { kind: "audio", url: `mock://music/${name}.mp3`, mimeType: "audio/mpeg", durationSec },
        meta: { provider: name, model: `${name}-v1`, useCase: "music", latencyMs: Date.now() - startedAt },
      };
    },
  };
}
