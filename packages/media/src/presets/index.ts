/**
 * Пресеты уникализации видео. Каждый — чистая функция (rng) => PresetPart.
 * Команда собирается массивом аргументов (buildUniqueArgs), без конкатенации shell-строк.
 */

/** Часть пайплайна: видео-фильтры, аудио-фильтры, доп. output-аргументы. */
export interface PresetPart {
  video?: string[];
  audio?: string[];
  output?: string[];
}

export type Rng = () => number;

/** Сидируемый ГПСЧ (mulberry32) — для воспроизводимых тестов. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r = (rng: Rng, min: number, max: number): number => min + rng() * (max - min);
const f = (n: number, digits = 4): string => n.toFixed(digits);

// ── Видео-фильтры ──
export const brightness = (rng: Rng = Math.random): PresetPart => ({
  video: [`eq=brightness=${f(r(rng, -0.06, 0.06))}`],
});
export const contrast = (rng: Rng = Math.random): PresetPart => ({
  video: [`eq=contrast=${f(r(rng, 0.95, 1.05))}`],
});
export const saturation = (rng: Rng = Math.random): PresetPart => ({
  video: [`eq=saturation=${f(r(rng, 0.95, 1.05))}`],
});
export const hue = (rng: Rng = Math.random): PresetPart => ({
  video: [`hue=h=${f(r(rng, -5, 5), 2)}`],
});
export const crop = (rng: Rng = Math.random): PresetPart => {
  const scale = f(r(rng, 0.97, 0.99));
  return { video: [`crop=in_w*${scale}:in_h*${scale}`] };
};
export const rotate = (rng: Rng = Math.random): PresetPart => {
  const deg = r(rng, 0.3, 1) * (rng() < 0.5 ? -1 : 1);
  return { video: [`rotate=${f((deg * Math.PI) / 180, 6)}:fillcolor=black`] };
};
export const addNoise = (rng: Rng = Math.random): PresetPart => ({
  video: [`noise=alls=${Math.round(r(rng, 5, 20))}:allf=t`],
});
export const vignette = (rng: Rng = Math.random): PresetPart => ({
  video: [`vignette=a=${f(r(rng, 0.3, 0.5))}`],
});
export const sharpen = (rng: Rng = Math.random): PresetPart => ({
  video: [`unsharp=5:5:${f(r(rng, 0.3, 0.9))}:5:5:0`],
});
export const mirror = (): PresetPart => ({ video: ["hflip"] });
export const endFreeze = (rng: Rng = Math.random): PresetPart => ({
  video: [`tpad=stop_mode=clone:stop_duration=${f(r(rng, 0.3, 0.7), 2)}`],
});
export const overlayLogo = (): PresetPart => ({
  // ЗАГЛУШКА watermark (drawbox, без шрифта/доп.входа). Реальный логотип — TASK 6.7.
  video: ["drawbox=x=10:y=10:w=40:h=12:color=white@0.4:t=fill"],
});

// ── Аудио-фильтры ──
export const speedUp = (rng: Rng = Math.random): PresetPart => {
  const factor = f(r(rng, 1.02, 1.08));
  return { video: [`setpts=PTS/${factor}`], audio: [`atempo=${factor}`] };
};
export const audioPitch = (rng: Rng = Math.random): PresetPart => {
  const factor = r(rng, 1.02, 1.05);
  return {
    audio: [`asetrate=44100*${f(factor)}`, "aresample=44100", `atempo=${f(1 / factor)}`],
  };
};

// ── Output-аргументы (контейнер/метаданные) ──
export const metadataStrip = (): PresetPart => ({ output: ["-map_metadata", "-1"] });
export const containerRemux = (): PresetPart => ({ output: ["-movflags", "+faststart"] });

/** Замена аудиодорожки (нужен доп. вход) — отдельно от composePresets. */
export function audioReplace(replacementPath: string): { inputs: string[]; output: string[] } {
  return {
    inputs: ["-i", replacementPath],
    output: ["-map", "0:v:0", "-map", "1:a:0", "-shortest"],
  };
}

/** Реестр композируемых пресетов (для случайной выборки). */
export const PRESETS: Record<string, (rng?: Rng) => PresetPart> = {
  brightness,
  contrast,
  saturation,
  hue,
  crop,
  rotate,
  addNoise,
  vignette,
  sharpen,
  mirror,
  endFreeze,
  overlayLogo,
  speedUp,
  audioPitch,
  metadataStrip,
  containerRemux,
};

export interface ComposedFilters {
  videoFilter: string;
  audioFilter: string;
  outputArgs: string[];
}

/** Объединяет пресеты в единые цепочки видео/аудио фильтров + output-аргументы. */
export function composePresets(parts: PresetPart[]): ComposedFilters {
  const video = parts.flatMap((p) => p.video ?? []);
  const audio = parts.flatMap((p) => p.audio ?? []);
  const outputArgs = parts.flatMap((p) => p.output ?? []);
  return { videoFilter: video.join(","), audioFilter: audio.join(","), outputArgs };
}

/** Собирает ffmpeg-аргументы (массив, без shell) для уникализации input → output. */
export function buildUniqueArgs(
  input: string,
  output: string,
  composed: ComposedFilters,
): string[] {
  const args = ["-i", input];
  if (composed.videoFilter) args.push("-vf", composed.videoFilter);
  if (composed.audioFilter) args.push("-af", composed.audioFilter);
  args.push("-c:v", "mpeg4", "-c:a", "aac", ...composed.outputArgs, "-y", output);
  return args;
}
