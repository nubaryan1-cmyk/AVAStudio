import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { probe } from "../ffmpeg/probe.js";
import { runFfmpeg } from "../ffmpeg/runner.js";

import { generatePreviewGif, generateThumbnail } from "./index.js";

let dir: string;
let source: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "avastudio-preview-"));
  source = join(dir, "src.mp4");
  await runFfmpeg([
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=4:size=640x360:rate=10",
    "-c:v",
    "mpeg4",
    "-pix_fmt",
    "yuv420p",
    "-y",
    source,
  ]);
}, 30_000);
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("generateThumbnail (реальный ffmpeg)", () => {
  it("создаёт JPEG-кадр", async () => {
    const out = join(dir, "thumb.jpg");
    await generateThumbnail(source, out, { atSec: 2 });
    expect((await stat(out)).size).toBeGreaterThan(0);
    const data = await probe(out);
    expect(data.video?.codec).toBe("mjpeg");
    expect(data.video?.width).toBe(640);
  }, 20_000);

  it("ресайзит превью по ширине", async () => {
    const out = join(dir, "thumb320.jpg");
    await generateThumbnail(source, out, { atSec: 1, width: 320 });
    const data = await probe(out);
    expect(data.video?.width).toBe(320);
  }, 20_000);
});

describe("generatePreviewGif (реальный ffmpeg)", () => {
  it("создаёт GIF шириной 480", async () => {
    const out = join(dir, "preview.gif");
    await generatePreviewGif(source, out, { durationSec: 2, fps: 10, width: 480 });
    expect((await stat(out)).size).toBeGreaterThan(0);
    const data = await probe(out);
    expect(data.video?.codec).toBe("gif");
    expect(data.video?.width).toBe(480);
  }, 20_000);
});
