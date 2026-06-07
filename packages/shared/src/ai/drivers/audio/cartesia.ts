/**
 * Каркас реального TTS-драйвера Cartesia — второй провайдер для fallback
 * (Фаза 2, TASK 11.4). Реализует AudioProvider. Без ключа неактивен.
 */
import type { AudioProvider, AudioRequest, AudioResult } from "../../types.js";

export interface CartesiaConfig {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

/** Создаёт каркас Cartesia TTS-провайдера (неактивен без ключа). */
export function createCartesiaProvider(config: CartesiaConfig = {}): AudioProvider {
  return {
    name: "cartesia-tts",
    useCase: "audio",
    async generateAudio(req: AudioRequest): Promise<AudioResult> {
      if (config.apiKey === undefined || config.apiKey === "") {
        throw new Error("cartesia-tts: API-ключ не настроен (Фаза 1 — только mock)");
      }
      void req;
      throw new Error("cartesia-tts: реальный драйвер активируется в Фазе 2");
    },
  };
}
