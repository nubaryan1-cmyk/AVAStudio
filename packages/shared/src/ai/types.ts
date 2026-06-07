import { z } from "zod";

/**
 * Provider-agnostic AI-генерация (ADR-014, TASK 11.1). Унифицированные параметры и
 * результаты для image/video/audio/music. Конкретные провайдеры — драйверы (Фаза 2),
 * в Фазе 1 — моки. Минимум 2 провайдера на use-case (fallback chain).
 */

export const AI_USE_CASES = ["image", "video", "audio", "music"] as const;
export type AiUseCase = (typeof AI_USE_CASES)[number];

/** Сгенерированный ассет (ссылка/путь + метаданные). */
export interface AiAsset {
  kind: "image" | "video" | "audio";
  /** URL или локальный путь результата. */
  url: string;
  mimeType: string;
  /** Размер в байтах (если известен) — для cost/usage (TASK 11.5). */
  bytes?: number;
  /** Длительность медиа в секундах (video/audio). */
  durationSec?: number;
  width?: number;
  height?: number;
}

/** Базовая мета результата генерации. */
export interface AiGenerationMeta {
  provider: string;
  model: string;
  useCase: AiUseCase;
  /** Латентность вызова, мс (для usage). */
  latencyMs: number;
}

// --- Изображения ---
export const imageRequestSchema = z.object({
  prompt: z.string().min(1),
  /** Напр. "1024x1024". */
  size: z.string().regex(/^\d+x\d+$/).optional(),
  style: z.string().optional(),
  /** Сколько изображений сгенерировать. */
  n: z.number().int().min(1).max(10).optional(),
});
export type ImageRequest = z.infer<typeof imageRequestSchema>;
export interface ImageResult {
  images: AiAsset[];
  meta: AiGenerationMeta;
}

// --- Видео (async-природа) ---
export const videoRequestSchema = z.object({
  prompt: z.string().min(1),
  durationSec: z.number().int().positive().max(60).optional(),
  /** Напр. "1080p". */
  resolution: z.string().optional(),
  /** Напр. "16:9", "9:16". */
  aspectRatio: z.string().optional(),
});
export type VideoRequest = z.infer<typeof videoRequestSchema>;

export const VIDEO_JOB_STATES = ["queued", "processing", "succeeded", "failed"] as const;
export type VideoJobState = (typeof VIDEO_JOB_STATES)[number];

/** Хэндл асинхронной видео-задачи (submit → poll). */
export interface VideoJobHandle {
  jobId: string;
  provider: string;
  state: VideoJobState;
}
export interface VideoJobStatus {
  jobId: string;
  state: VideoJobState;
  /** Прогресс 0..1 (если провайдер сообщает). */
  progress?: number;
  /** Результат при state="succeeded". */
  video?: AiAsset;
  meta?: AiGenerationMeta;
  /** Сообщение при state="failed". */
  error?: string;
}

// --- Аудио (TTS) ---
export const audioRequestSchema = z.object({
  text: z.string().min(1),
  voice: z.string().optional(),
  /** ISO-код языка, напр. "ru", "en". */
  language: z.string().optional(),
});
export type AudioRequest = z.infer<typeof audioRequestSchema>;
export interface AudioResult {
  audio: AiAsset;
  meta: AiGenerationMeta;
}

// --- Музыка ---
export const musicRequestSchema = z.object({
  prompt: z.string().min(1),
  durationSec: z.number().int().positive().max(300).optional(),
  genre: z.string().optional(),
});
export type MusicRequest = z.infer<typeof musicRequestSchema>;

/** Интерфейсы провайдеров по use-case. Каждый реальный/mock-драйвер реализует один. */
export interface ImageProvider {
  readonly name: string;
  readonly useCase: "image";
  generateImage(req: ImageRequest): Promise<ImageResult>;
}
export interface VideoProvider {
  readonly name: string;
  readonly useCase: "video";
  /** Старт асинхронной задачи. */
  submitVideo(req: VideoRequest): Promise<VideoJobHandle>;
  /** Опрос статуса/результата. */
  pollVideo(jobId: string): Promise<VideoJobStatus>;
}
export interface AudioProvider {
  readonly name: string;
  readonly useCase: "audio";
  generateAudio(req: AudioRequest): Promise<AudioResult>;
}
export interface MusicProvider {
  readonly name: string;
  readonly useCase: "music";
  generateMusic(req: MusicRequest): Promise<AudioResult>;
}

export type AnyAiProvider = ImageProvider | VideoProvider | AudioProvider | MusicProvider;
