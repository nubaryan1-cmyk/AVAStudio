import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runFfmpeg } from "../ffmpeg/runner.js";
import { mulberry32 } from "../presets/index.js";

import { planConveyor } from "./conveyor.js";
import { fakeDeviceMetadata, LEGACY_DEVICE_MODELS, LEGACY_MANUFACTURERS } from "./fake-metadata.js";
import { FPS_JITTERS, fpsJitter } from "./fps-jitter.js";
import {
  buildTrimSplitSpeedupFilter,
  LEGACY_SPEED_FACTOR,
  LEGACY_TOTAL_DURATION_SEC,
} from "./trim-split-speedup.js";
import { zoomNoBorders } from "./zoom.js";

const execFileAsync = promisify(execFile);

describe("trim-split-speedup", () => {
  it("строит filter_complex с concat двух сегментов", () => {
    const fc = buildTrimSplitSpeedupFilter({ splitPointSec: 1.8 });
    expect(fc).toContain("trim=0:1.8");
    expect(fc).toContain(`atempo=${LEGACY_SPEED_FACTOR.toFixed(1)}`);
    expect(fc).toContain("concat=n=2:v=1:a=1");
    expect(LEGACY_TOTAL_DURATION_SEC).toBe(5.0);
  });
});

describe("zoomNoBorders", () => {
  it("scale + crop возвращают исходный размер (нет чёрных полей)", () => {
    const p = zoomNoBorders(mulberry32(1));
    expect(p.video?.[0]).toMatch(/^scale=iw\*/);
    expect(p.video?.[1]).toMatch(/^crop=iw\//);
  });
});

describe("fpsJitter", () => {
  it("сдвигает fps на одну из дельт пула", () => {
    const p = fpsJitter(30, mulberry32(7));
    const r = Number(p.output?.[1]);
    expect(p.output?.[0]).toBe("-r");
    const expected = new Set(FPS_JITTERS.map((d) => Math.max(1, Number((30 + d).toFixed(3)))));
    expect([...expected]).toContain(r);
  });
});

describe("fakeDeviceMetadata", () => {
  it("содержит -map_metadata -1 и фейковые поля устройства", () => {
    const p = fakeDeviceMetadata(mulberry32(3));
    const args = p.output!.join(" ");
    expect(args).toContain("-map_metadata -1");
    expect(args).toMatch(/device_manufacturer=(Apple|Samsung|Google|OnePlus)/);
    expect(args).toMatch(/device_model=/);
  });
  it("пулы устройств/производителей не пустые (из legacy)", () => {
    expect(LEGACY_DEVICE_MODELS.length).toBe(15);
    expect(LEGACY_MANUFACTURERS.length).toBe(8);
  });
});

describe("planConveyor (Cartesian)", () => {
  it("2 reactions × 3 flashes → 6 заданий", () => {
    const jobs = planConveyor(["r1", "r2"], ["f1", "f2", "f3"]);
    expect(jobs).toHaveLength(6);
    expect(jobs[0]).toMatchObject({ reaction: "r1", flash: "f1", music: null, index: 0 });
  });
  it("music ротируется по index", () => {
    const jobs = planConveyor(["r1"], ["f1", "f2", "f3"], ["m1", "m2"]);
    expect(jobs.map((j) => j.music)).toEqual(["m1", "m2", "m1"]);
  });
});

describe("реальный ffmpeg: fake-metadata применяются", () => {
  let dir: string;
  let source: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "avastudio-legacy-"));
    source = join(dir, "src.mp4");
    await runFfmpeg([
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=1:size=160x120:rate=10",
      "-c:v",
      "mpeg4",
      "-y",
      source,
    ]);
  }, 30_000);
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("ffprobe видит подставленные device_model и device_manufacturer", async () => {
    const out = join(dir, "fake.mp4");
    const part = fakeDeviceMetadata(mulberry32(42));
    await runFfmpeg(["-i", source, ...part.output!, "-c:v", "mpeg4", "-y", out]);
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format_tags",
      "-of",
      "default=noprint_wrappers=1",
      out,
    ]);
    expect(stdout).toMatch(/device_model=(iPhone|Samsung|Google|OnePlus)/);
    expect(stdout).toMatch(/device_manufacturer=(Apple|Samsung|Google|OnePlus)/);
  }, 20_000);
});
