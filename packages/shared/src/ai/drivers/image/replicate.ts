/**
 * Каркас реального image-драйвера Replicate (Flux) — второй провайдер для fallback
 * (Фаза 2, TASK 11.2). Структура готова, без токена неактивен. Реализует ImageProvider.
 */
import type { ImageProvider, ImageRequest, ImageResult } from "../../types.js";

export interface ReplicateImageConfig {
  apiToken?: string;
  /** Напр. "black-forest-labs/flux-schnell". */
  modelVersion?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_MODEL = "black-forest-labs/flux-schnell";

/** Создаёт каркас Replicate Flux image-провайдера (неактивен без токена). */
export function createReplicateImageProvider(config: ReplicateImageConfig = {}): ImageProvider {
  const modelVersion = config.modelVersion ?? DEFAULT_MODEL;
  return {
    name: "replicate-flux",
    useCase: "image",
    async generateImage(req: ImageRequest): Promise<ImageResult> {
      if (config.apiToken === undefined || config.apiToken === "") {
        throw new Error("replicate-flux: API-токен не настроен (Фаза 1 — только mock)");
      }
      // --- ФАЗА 2: создать prediction на Replicate, дождаться output, смаппить в ImageResult ---
      void modelVersion;
      void req;
      throw new Error("replicate-flux: реальный драйвер активируется в Фазе 2");
    },
  };
}
