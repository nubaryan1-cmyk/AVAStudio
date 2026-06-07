/**
 * Реестр AI-провайдеров по use-case (TASK 11.1). Хранит упорядоченные цепочки
 * провайдеров (порядок = приоритет fallback). Провайдеро-независим: регистрируются
 * любые драйверы (mock в Фазе 1, реальные в Фазе 2), минимум 2 на use-case.
 */
import { runWithFallback, type FallbackResult } from "./fallback.js";

import type {
  AudioProvider,
  AudioRequest,
  AudioResult,
  ImageProvider,
  ImageRequest,
  ImageResult,
  MusicProvider,
  MusicRequest,
  VideoJobHandle,
  VideoProvider,
  VideoRequest,
} from "./types.js";

export interface AiProviderRegistry {
  image: readonly ImageProvider[];
  video: readonly VideoProvider[];
  audio: readonly AudioProvider[];
  music: readonly MusicProvider[];
}

export interface AiRegistryInit {
  image?: readonly ImageProvider[];
  video?: readonly VideoProvider[];
  audio?: readonly AudioProvider[];
  music?: readonly MusicProvider[];
}

/** Создаёт неизменяемый реестр с дефолтными пустыми цепочками. */
export function createRegistry(init: AiRegistryInit = {}): AiProviderRegistry {
  return {
    image: init.image ?? [],
    video: init.video ?? [],
    audio: init.audio ?? [],
    music: init.music ?? [],
  };
}

/** Генерация изображения с fallback по цепочке image-провайдеров. */
export function generateImage(
  reg: AiProviderRegistry,
  req: ImageRequest,
): Promise<FallbackResult<ImageResult>> {
  return runWithFallback(reg.image, (p) => p.generateImage(req));
}

/** Старт асинхронной видео-задачи с fallback по цепочке video-провайдеров. */
export function submitVideo(
  reg: AiProviderRegistry,
  req: VideoRequest,
): Promise<FallbackResult<VideoJobHandle>> {
  return runWithFallback(reg.video, (p) => p.submitVideo(req));
}

/** Генерация речи (TTS) с fallback по цепочке audio-провайдеров. */
export function generateAudio(
  reg: AiProviderRegistry,
  req: AudioRequest,
): Promise<FallbackResult<AudioResult>> {
  return runWithFallback(reg.audio, (p) => p.generateAudio(req));
}

/** Генерация музыки с fallback по цепочке music-провайдеров. */
export function generateMusic(
  reg: AiProviderRegistry,
  req: MusicRequest,
): Promise<FallbackResult<AudioResult>> {
  return runWithFallback(reg.music, (p) => p.generateMusic(req));
}
