/**
 * Реальный TTS-драйвер ElevenLabs (TASK 21.1, активация каркаса 11.4). Реализует
 * AudioProvider; HTTP через внедряемый fetchImpl. Без ключа неактивен.
 */
import type { AudioProvider, AudioRequest, AudioResult } from "../../types.js";

export interface ElevenLabsConfig {
  apiKey?: string;
  voiceId?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_VOICE = "Rachel";
const DEFAULT_MODEL = "eleven_multilingual_v2";

export function createElevenLabsProvider(config: ElevenLabsConfig = {}): AudioProvider {
  const voiceId = config.voiceId ?? DEFAULT_VOICE;
  const model = config.model ?? DEFAULT_MODEL;
  return {
    name: "elevenlabs-tts",
    useCase: "audio",
    async generateAudio(req: AudioRequest): Promise<AudioResult> {
      if (config.apiKey === undefined || config.apiKey === "") {
        throw new Error("elevenlabs-tts: API-ключ не настроен");
      }
      const fetchImpl = config.fetchImpl ?? fetch;
      const startedAt = Date.now();
      const res = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: "POST",
        headers: { "xi-api-key": config.apiKey, "content-type": "application/json" },
        body: JSON.stringify({ text: req.text, model_id: model }),
      });
      if (!res.ok) throw new Error(`elevenlabs-tts: HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length === 0) throw new Error("elevenlabs-tts: пустой аудио-ответ");
      return {
        audio: {
          kind: "audio",
          url: `data:audio/mpeg;base64,${Buffer.from(bytes).toString("base64")}`,
          mimeType: "audio/mpeg",
          bytes: bytes.length,
        },
        meta: { provider: "elevenlabs-tts", model, useCase: "audio", latencyMs: Date.now() - startedAt },
      };
    },
  };
}
