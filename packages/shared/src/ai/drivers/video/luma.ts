/**
 * Каркас реального video-драйвера Luma Dream Machine — второй провайдер для fallback
 * (Фаза 2, TASK 11.3). Async submit→poll. Без ключа неактивен. Реализует VideoProvider.
 */
import type { VideoJobHandle, VideoJobStatus, VideoProvider, VideoRequest } from "../../types.js";

export interface LumaVideoConfig {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

/** Создаёт каркас Luma video-провайдера (неактивен без ключа). */
export function createLumaVideoProvider(config: LumaVideoConfig = {}): VideoProvider {
  function ensureActive(): void {
    if (config.apiKey === undefined || config.apiKey === "") {
      throw new Error("luma-video: API-ключ не настроен (Фаза 1 — только mock)");
    }
  }
  return {
    name: "luma-video",
    useCase: "video",
    async submitVideo(req: VideoRequest): Promise<VideoJobHandle> {
      ensureActive();
      void req;
      throw new Error("luma-video: реальный драйвер активируется в Фазе 2");
    },
    async pollVideo(jobId: string): Promise<VideoJobStatus> {
      ensureActive();
      void jobId;
      throw new Error("luma-video: реальный драйвер активируется в Фазе 2");
    },
  };
}
