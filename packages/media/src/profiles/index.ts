import type { ProbeData } from "../ffmpeg/probe.js";

/** Платформенный профиль вывода. */
export interface PlatformProfile {
  id: string;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string;
  audioBitrate: string;
  fps: number;
  maxDurationSec: number;
  extraArgs: string[];
}

export type ProfileId =
  | "instagram-reels"
  | "instagram-feed-4-5"
  | "instagram-feed-1-1"
  | "tiktok"
  | "reddit"
  | "threads";

const FASTSTART = ["-movflags", "+faststart", "-profile:v", "high", "-pix_fmt", "yuv420p"];

export const PROFILES: Record<ProfileId, PlatformProfile> = {
  "instagram-reels": {
    id: "instagram-reels",
    width: 1080,
    height: 1920,
    videoCodec: "libx264",
    audioCodec: "aac",
    audioBitrate: "128k",
    fps: 30,
    maxDurationSec: 90,
    extraArgs: FASTSTART,
  },
  "instagram-feed-4-5": {
    id: "instagram-feed-4-5",
    width: 1080,
    height: 1350,
    videoCodec: "libx264",
    audioCodec: "aac",
    audioBitrate: "128k",
    fps: 30,
    maxDurationSec: 60,
    extraArgs: FASTSTART,
  },
  "instagram-feed-1-1": {
    id: "instagram-feed-1-1",
    width: 1080,
    height: 1080,
    videoCodec: "libx264",
    audioCodec: "aac",
    audioBitrate: "128k",
    fps: 30,
    maxDurationSec: 60,
    extraArgs: FASTSTART,
  },
  tiktok: {
    id: "tiktok",
    width: 1080,
    height: 1920,
    videoCodec: "libx264",
    audioCodec: "aac",
    audioBitrate: "128k",
    fps: 30,
    maxDurationSec: 180,
    extraArgs: FASTSTART,
  },
  reddit: {
    id: "reddit",
    width: 1080,
    height: 1920,
    videoCodec: "libx264",
    audioCodec: "aac",
    audioBitrate: "128k",
    fps: 30,
    maxDurationSec: 900,
    extraArgs: FASTSTART,
  },
  threads: {
    id: "threads",
    width: 1080,
    height: 1920,
    videoCodec: "libx264",
    audioCodec: "aac",
    audioBitrate: "128k",
    fps: 30,
    maxDurationSec: 90,
    extraArgs: FASTSTART,
  },
};

export type FitMode = "pad" | "crop";

/** Видео-фильтр приведения к разрешению профиля: pad (чёрные полосы) или crop. */
export function buildFitFilter(profile: PlatformProfile, fit: FitMode): string {
  const { width: w, height: h } = profile;
  if (fit === "crop") {
    return `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`;
  }
  return `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`;
}

/** Собирает ffmpeg-аргументы (массив) для приведения input → формат платформы. */
export function applyProfile(
  input: string,
  output: string,
  profileId: ProfileId,
  options: { fit?: FitMode } = {},
): string[] {
  const profile = PROFILES[profileId];
  const fit = options.fit ?? "pad";
  const vf = `${buildFitFilter(profile, fit)},fps=${profile.fps}`;
  return [
    "-i",
    input,
    "-vf",
    vf,
    "-c:v",
    profile.videoCodec,
    "-c:a",
    profile.audioCodec,
    "-b:a",
    profile.audioBitrate,
    "-ac",
    "2",
    "-t",
    String(profile.maxDurationSec),
    ...profile.extraArgs,
    "-y",
    output,
  ];
}

export interface ProfileCheckResult {
  ok: boolean;
  issues: string[];
}

/** Проверяет, что метаданные выхода соответствуют требованиям профиля. */
export function checkProfile(data: ProbeData, profileId: ProfileId): ProfileCheckResult {
  const profile = PROFILES[profileId];
  const issues: string[] = [];
  if (!data.video) {
    issues.push("нет видеопотока");
  } else {
    if (data.video.width !== profile.width)
      issues.push(`ширина ${data.video.width} ≠ ${profile.width}`);
    if (data.video.height !== profile.height)
      issues.push(`высота ${data.video.height} ≠ ${profile.height}`);
    if (!data.video.codec.includes("h264")) issues.push(`кодек ${data.video.codec} ≠ h264`);
  }
  if (data.durationSec > profile.maxDurationSec + 0.5) {
    issues.push(`длительность ${data.durationSec} > ${profile.maxDurationSec}`);
  }
  return { ok: issues.length === 0, issues };
}
