import {
  applyProfile,
  applyWatermark,
  brightness,
  buildUniqueArgs,
  collectRenderMetrics,
  composePresets,
  contrast,
  hue,
  metadataStrip,
  mulberry32,
  normalizeLoudness,
  probe,
  runFfmpegSandboxed,
  saturation,
  speedUp,
  type CollectMetricsParams,
  type PlatformProfile,
  type ProbeData,
  type ProfileId,
  type RenderMetrics,
  type WatermarkConfig,
  PROFILES,
} from "@avastudio/media";

/** Опции одного шага рендера. */
export interface StepProgress {
  /** Колбэк прогресса шага в долях [0..1]. */
  onProgress?: (fraction: number) => void;
}

/**
 * Абстракция медиа-конвейера. Реальная реализация (`createDefaultPipeline`) дергает FFmpeg
 * через пакет @avastudio/media; в тестах подменяется фейком (FFmpeg не нужен).
 */
export interface MediaPipeline {
  probe(input: string): Promise<ProbeData>;
  /** Уникализация: набор сидируемых пресетов → возвращает exit-код FFmpeg и цепочку пресетов. */
  uniquify(
    input: string,
    output: string,
    opts: { seed: number; durationSec: number } & StepProgress,
  ): Promise<{ exitCode: number; presetChain: string[] }>;
  /** Приведение к формату платформы. */
  toProfile(input: string, output: string, profileId: ProfileId): Promise<{ exitCode: number }>;
  /** Двухпроходная LUFS-нормализация громкости. */
  normalizeAudio(input: string, output: string): Promise<void>;
  /** Наложение watermark по конфигу. */
  watermark(input: string, output: string, config: WatermarkConfig): Promise<void>;
  /** Сбор метрик рендера для записи в render_metrics. */
  collectMetrics(params: CollectMetricsParams): Promise<RenderMetrics>;
}

export interface DefaultPipelineOptions {
  ffmpegPath?: string;
  ffprobePath?: string;
}

/** Фиксированный набор composable-пресетов для уникализации (детерминирован сидом). */
const UNIQUE_PRESET_CHAIN = [
  "brightness",
  "contrast",
  "saturation",
  "hue",
  "speedUp",
  "metadataStrip",
] as const;

/** Профиль по умолчанию, если в job не задан валидный profileId. */
export const DEFAULT_PROFILE_ID: ProfileId = "instagram-reels";

/** Возвращает профиль платформы по id (с fallback на дефолт). */
export function resolveProfile(profileId: string | undefined): {
  id: ProfileId;
  profile: PlatformProfile;
} {
  const id = (profileId && profileId in PROFILES ? profileId : DEFAULT_PROFILE_ID) as ProfileId;
  return { id, profile: PROFILES[id] };
}

/** Реальный конвейер на базе FFmpeg (пакет @avastudio/media). */
export function createDefaultPipeline(options: DefaultPipelineOptions = {}): MediaPipeline {
  const ffmpeg = options.ffmpegPath ? { ffmpegPath: options.ffmpegPath } : {};
  const ffprobe = options.ffprobePath ? { ffprobePath: options.ffprobePath } : {};

  return {
    probe: (input) => probe(input, ffprobe),

    async uniquify(input, output, opts) {
      const rng = mulberry32(opts.seed);
      const parts = [
        brightness(rng),
        contrast(rng),
        saturation(rng),
        hue(rng),
        speedUp(rng),
        metadataStrip(),
      ];
      const composed = composePresets(parts);
      const args = buildUniqueArgs(input, output, composed);
      const res = await runFfmpegSandboxed(args, {
        ...ffmpeg,
        onProgress: (p) => {
          if (opts.onProgress && opts.durationSec > 0) {
            opts.onProgress(Math.min(1, p.timeMs / (opts.durationSec * 1000)));
          }
        },
      });
      return { exitCode: res.code, presetChain: [...UNIQUE_PRESET_CHAIN] };
    },

    async toProfile(input, output, profileId) {
      const args = applyProfile(input, output, profileId);
      const res = await runFfmpegSandboxed(args, ffmpeg);
      return { exitCode: res.code };
    },

    normalizeAudio: (input, output) => normalizeLoudness(input, output, ffmpeg),

    watermark: async (input, output, config) => {
      await applyWatermark(input, output, config.logoPath, {
        position: config.position,
        opacity: config.opacity,
        margin: config.margin,
        ...ffmpeg,
      });
    },

    collectMetrics: (params) =>
      collectRenderMetrics(options.ffprobePath ? { ...params, ffprobePath: options.ffprobePath } : params),
  };
}
