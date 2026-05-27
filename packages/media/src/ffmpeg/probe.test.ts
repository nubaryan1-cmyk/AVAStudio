import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  PROBE_LIMITS,
  probe,
  probeAndValidate,
  validateProbeData,
  type ProbeData,
} from "./probe.js";
import { runFfmpeg } from "./runner.js";

let dir: string;
let videoPath: string;
let audioPath: string;
let brokenPath: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "avastudio-probe-"));
  videoPath = join(dir, "video.mp4");
  audioPath = join(dir, "audio.m4a");
  brokenPath = join(dir, "broken.mp4");

  await runFfmpeg([
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=1:size=320x240:rate=10",
    "-c:v",
    "mpeg4",
    "-pix_fmt",
    "yuv420p",
    "-y",
    videoPath,
  ]);
  await runFfmpeg([
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=1",
    "-c:a",
    "aac",
    "-y",
    audioPath,
  ]);
  await writeFile(brokenPath, "this is not a video file");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("probe (реальный ffprobe)", () => {
  it("возвращает типизированные метаданные видео", async () => {
    const data = await probe(videoPath);
    expect(data.video).not.toBeNull();
    expect(data.video?.width).toBe(320);
    expect(data.video?.height).toBe(240);
    expect(data.durationSec).toBeGreaterThan(0);
    expect(data.streamCount).toBeGreaterThanOrEqual(1);
  });

  it("битый/не-медиа файл → ValidationError", async () => {
    await expect(probe(brokenPath)).rejects.toThrow();
  });
});

describe("validateProbeData (лимиты)", () => {
  const valid: ProbeData = {
    durationSec: 5,
    sizeBytes: 1024,
    bitrate: 1000,
    streamCount: 2,
    video: { codec: "h264", width: 1080, height: 1920, fps: 30 },
    audio: { codec: "aac", channels: 2 },
  };

  it("валидные данные проходят", () => {
    expect(validateProbeData(valid).durationSec).toBe(5);
  });
  it("слишком длинное → reject", () => {
    expect(() =>
      validateProbeData({ ...valid, durationSec: PROBE_LIMITS.MAX_DURATION_SEC + 1 }),
    ).toThrow();
  });
  it("слишком большое → reject", () => {
    expect(() =>
      validateProbeData({ ...valid, sizeBytes: PROBE_LIMITS.MAX_SIZE_BYTES + 1 }),
    ).toThrow();
  });
  it("слишком много потоков → reject", () => {
    expect(() =>
      validateProbeData({ ...valid, streamCount: PROBE_LIMITS.MAX_STREAMS + 1 }),
    ).toThrow();
  });
  it("разрешение > 4K → reject", () => {
    expect(() =>
      validateProbeData({ ...valid, video: { ...valid.video!, width: 5000 } }),
    ).toThrow();
  });
  it("нет видеопотока → reject", () => {
    expect(() => validateProbeData({ ...valid, video: null })).toThrow();
  });
});

describe("probeAndValidate (реальный ffprobe)", () => {
  it("валидное видео проходит", async () => {
    const data = await probeAndValidate(videoPath);
    expect(data.video?.codec).toBeTruthy();
  });
  it("аудио-файл (нет видео) → reject", async () => {
    await expect(probeAndValidate(audioPath)).rejects.toThrow();
  });
});
