import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runFfmpeg } from "../ffmpeg/runner.js";

import { applyWatermark, resolveWatermark } from "./index.js";

const execFileAsync = promisify(execFile);

describe("resolveWatermark (тариф-логика, через параметр)", () => {
  it("free → обязательный дефолтный логотип", () => {
    const r = resolveWatermark("free", { defaultLogoPath: "/logo.png" });
    expect(r?.logoPath).toBe("/logo.png");
  });
  it("paid → null без запроса, логотип при enabledForPaid", () => {
    expect(resolveWatermark("paid", { defaultLogoPath: "/logo.png" })).toBeNull();
    expect(
      resolveWatermark("paid", { defaultLogoPath: "/logo.png", enabledForPaid: true })?.logoPath,
    ).toBe("/logo.png");
  });
  it("b2b → кастомный логотип (или null)", () => {
    expect(resolveWatermark("b2b", { customLogoPath: "/brand.png" })?.logoPath).toBe("/brand.png");
    expect(resolveWatermark("b2b", {})).toBeNull();
  });
});

describe("applyWatermark (реальный overlay)", () => {
  let dir: string;
  let source: string;
  let logo: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "avastudio-wm-"));
    source = join(dir, "src.mp4");
    logo = join(dir, "logo.png");
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
      source,
    ]);
    // красный логотип 40x20
    await runFfmpeg(["-f", "lavfi", "-i", "color=c=red:size=40x20", "-frames:v", "1", "-y", logo]);
  }, 30_000);
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("логотип присутствует в кадре (верхний левый угол ≈ красный)", async () => {
    const out = join(dir, "wm.mp4");
    await applyWatermark(source, out, logo, { position: "top-left", margin: 0, opacity: 1 });

    // выбираем усреднённый пиксель области логотипа (40x20 top-left)
    const pix = join(dir, "pix.raw");
    await execFileAsync("ffmpeg", [
      "-i",
      out,
      "-frames:v",
      "1",
      "-vf",
      "crop=40:20:0:0,scale=1:1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-y",
      pix,
    ]);
    const rgb = await readFile(pix);
    const [r, g, b] = [rgb[0]!, rgb[1]!, rgb[2]!];
    expect(r).toBeGreaterThan(120);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  }, 20_000);
});
