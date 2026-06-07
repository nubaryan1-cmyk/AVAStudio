/**
 * Реальный music-драйвер Suno (TASK 21.1, активация каркаса 11.4). Реализует
 * MusicProvider; HTTP через внедряемый fetchImpl. Без ключа неактивен.
 */
import type { AudioResult, MusicProvider, MusicRequest } from "../../types.js";

export interface SunoConfig {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

const DEFAULT_MODEL = "chirp-v3";
const DEFAULT_BASE = "https://api.suno.ai/v1";

interface SunoResponse {
  audio_url?: string;
  duration?: number;
}

export function createSunoProvider(config: SunoConfig = {}): MusicProvider {
  const model = config.model ?? DEFAULT_MODEL;
  const base = config.baseUrl ?? DEFAULT_BASE;
  return {
    name: "suno-music",
    useCase: "music",
    async generateMusic(req: MusicRequest): Promise<AudioResult> {
      if (config.apiKey === undefined || config.apiKey === "") {
        throw new Error("suno-music: API-ключ не настроен");
      }
      const fetchImpl = config.fetchImpl ?? fetch;
      const startedAt = Date.now();
      const res = await fetchImpl(`${base}/generate`, {
        method: "POST",
        headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({ model, prompt: req.prompt, duration: req.durationSec ?? 30 }),
      });
      if (!res.ok) throw new Error(`suno-music: HTTP ${res.status}`);
      const json = (await res.json()) as SunoResponse;
      if (!json.audio_url) throw new Error("suno-music: нет audio_url");
      return {
        audio: {
          kind: "audio",
          url: json.audio_url,
          mimeType: "audio/mpeg",
          ...(json.duration ? { durationSec: json.duration } : {}),
        },
        meta: { provider: "suno-music", model, useCase: "music", latencyMs: Date.now() - startedAt },
      };
    },
  };
}
