import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { probe } from "../ffmpeg/probe.js";
import { runFfmpeg } from "../ffmpeg/runner.js";

import { PROFILES, applyProfile, buildFitFilter, checkProfile, type ProfileId } from "./index.js";

describe("профили (структура)", () => {
  it("есть профили IG Reels/Feed, TikTok, Reddit, Threads", () => {
    for (const id of [
      "instagram-reels",
      "instagram-feed-4-5",
      "instagram-feed-1-1",
      "tiktok",
      "reddit",
      "threads",
    ] as ProfileId[]) {
      expect(PROFILES[id]).toBeDefined();
    }
    expect(PROFILES["instagram-reels"]).toMatchObject({
      width: 1080,
      height: 1920,
      fps: 30,
      maxDurationSec: 90,
    });
  });

  it("buildFitFilter: pad добавляет чёрные поля, crop — обрезку", () => {
    const p = PROFILES.tiktok;
    expect(buildFitFilter(p, "pad")).toContain("pad=1080:1920");
    expect(buildFitFilter(p, "crop")).toContain("crop=1080:1920");
  });
});

describe("applyProfile → реальный рендер 4 платформ из 1 видео", () => {
  let dir: string;
  let source: string;
  const targets: ProfileId[] = ["instagram-reels", "tiktok", "reddit", "threads"];

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "avastudio-profiles-"));
    source = join(dir, "src.mp4");
    // источник 4:3 (320x240) — проверим resize+pad в 9:16
    await runFfmpeg([
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=0.5:size=320x240:rate=10",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=0.5",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-shortest",
      "-y",
      source,
    ]);
  }, 30_000);
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("каждый формат соответствует своему checker", async () => {
    for (const id of targets) {
      const out = join(dir, `${id}.mp4`);
      const result = await runFfmpeg(applyProfile(source, out, id));
      expect(result.code, `${id}: ${result.stderr.slice(-200)}`).toBe(0);

      const data = await probe(out);
      const check = checkProfile(data, id);
      expect(check.ok, `${id}: ${check.issues.join(", ")}`).toBe(true);
      expect(data.video?.width).toBe(PROFILES[id].width);
      expect(data.video?.height).toBe(PROFILES[id].height);
    }
  }, 60_000);

  it("checkProfile отклоняет несоответствие разрешения", async () => {
    const out = join(dir, "wrong.mp4");
    await runFfmpeg(applyProfile(source, out, "instagram-feed-1-1")); // 1080x1080
    const data = await probe(out);
    expect(checkProfile(data, "instagram-reels").ok).toBe(false); // ожидался 1080x1920
  }, 30_000);
});
