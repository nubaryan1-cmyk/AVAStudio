import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runFfmpeg } from "../ffmpeg/runner.js";

import { LOUDNESS_TARGETS, measureLoudness, normalizeLoudness } from "./loudness.js";

describe("LOUDNESS_TARGETS", () => {
  it("IG/TikTok = -14, YouTube = -16", () => {
    expect(LOUDNESS_TARGETS.instagram).toBe(-14);
    expect(LOUDNESS_TARGETS.tiktok).toBe(-14);
    expect(LOUDNESS_TARGETS.youtube).toBe(-16);
  });
});

describe("нормализация громкости (реальный ffmpeg)", () => {
  let dir: string;
  let loud: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "avastudio-loud-"));
    loud = join(dir, "loud.mp4");
    // громкий источник: полноамплитудный синус (≈ -3 LUFS) + видео
    await runFfmpeg([
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=3:size=128x72:rate=10",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:duration=3",
      "-c:v",
      "mpeg4",
      "-c:a",
      "aac",
      "-shortest",
      "-y",
      loud,
    ]);
  }, 30_000);
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("источник заметно отличается от целевого -14 LUFS", async () => {
    const m = await measureLoudness(loud);
    expect(Math.abs(Number(m.input_i) - -14)).toBeGreaterThan(2);
  }, 30_000);

  it("после нормализации ≈ -14 LUFS (±1.5)", async () => {
    const out = join(dir, "norm.mp4");
    await normalizeLoudness(loud, out, { target: -14 });
    const after = await measureLoudness(out);
    expect(Number(after.input_i)).toBeGreaterThan(-15.5);
    expect(Number(after.input_i)).toBeLessThan(-12.5);
  }, 40_000);
});
