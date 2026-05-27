import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { parseProgressTimeMs, runFfmpeg } from "./runner.js";

describe("parseProgressTimeMs", () => {
  it("парсит time= в миллисекунды", () => {
    expect(parseProgressTimeMs("frame=10 fps=0 time=00:00:01.50 bitrate=")).toBe(1500);
    expect(parseProgressTimeMs("time=01:02:03.00")).toBe(3_723_000);
  });
  it("возвращает null без time=", () => {
    expect(parseProgressTimeMs("no progress here")).toBeNull();
  });
});

describe("runFfmpeg (реальная транскодировка)", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "avastudio-media-"));
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("транскодирует синтетическое видео (lavfi) → mp4: code 0, файл создан, прогресс получен", async () => {
    const output = join(dir, "out.mp4");
    const progress: number[] = [];
    const result = await runFfmpeg(
      [
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=1:size=320x240:rate=10",
        "-c:v",
        "mpeg4",
        "-pix_fmt",
        "yuv420p",
        "-y",
        output,
      ],
      { onProgress: (p) => progress.push(p.timeMs) },
    );
    expect(result.code).toBe(0);
    const info = await stat(output);
    expect(info.size).toBeGreaterThan(0);
    expect(progress.length).toBeGreaterThan(0);
  });

  it("возвращает ненулевой code на битых аргументах", async () => {
    const result = await runFfmpeg(["-i", "/nonexistent/file.mp4", "-y", join(dir, "x.mp4")]);
    expect(result.code).not.toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});
