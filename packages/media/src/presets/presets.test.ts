import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runFfmpeg } from "../ffmpeg/runner.js";

import {
  PRESETS,
  brightness,
  buildUniqueArgs,
  composePresets,
  metadataStrip,
  mulberry32,
  type PresetPart,
} from "./index.js";

const execFileAsync = promisify(execFile);

describe("пресеты (чистые функции)", () => {
  it("16 композируемых пресетов в реестре", () => {
    expect(Object.keys(PRESETS)).toHaveLength(16);
  });
  it("каждый пресет возвращает валидный PresetPart с фильтрами/аргументами", () => {
    for (const [name, fn] of Object.entries(PRESETS)) {
      const part = fn(mulberry32(1));
      const total =
        (part.video?.length ?? 0) + (part.audio?.length ?? 0) + (part.output?.length ?? 0);
      expect(total, name).toBeGreaterThan(0);
    }
  });
  it("brightness детерминирован при одном seed, различен при разных", () => {
    expect(brightness(mulberry32(5))).toEqual(brightness(mulberry32(5)));
    expect(brightness(mulberry32(5))).not.toEqual(brightness(mulberry32(6)));
  });
});

describe("composePresets", () => {
  it("объединяет видео/аудио/output цепочки", () => {
    const parts: PresetPart[] = [
      { video: ["eq=brightness=0.01"] },
      { video: ["hflip"], audio: ["atempo=1.03"] },
      { output: ["-map_metadata", "-1"] },
    ];
    const c = composePresets(parts);
    expect(c.videoFilter).toBe("eq=brightness=0.01,hflip");
    expect(c.audioFilter).toBe("atempo=1.03");
    expect(c.outputArgs).toEqual(["-map_metadata", "-1"]);
  });
});

describe("уникализация (реальный ffmpeg)", () => {
  let dir: string;
  let source: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "avastudio-presets-"));
    source = join(dir, "src.mp4");
    await runFfmpeg([
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=0.4:size=128x72:rate=5",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=0.4",
      "-c:v",
      "mpeg4",
      "-c:a",
      "aac",
      "-shortest",
      "-y",
      source,
    ]);
  });
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("100 случайных вариантов → 100 разных md5", async () => {
    const names = Object.keys(PRESETS).filter(
      (n) => n !== "metadataStrip" && n !== "containerRemux",
    );
    const hashes = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      const rng = mulberry32(i + 1);
      // brightness (непрерывный рандом) гарантирует различие + случайное подмножество
      const parts: PresetPart[] = [brightness(rng)];
      for (const name of names) {
        if (rng() < 0.35) parts.push(PRESETS[name]!(rng));
      }
      const out = join(dir, `v${i}.mp4`);
      const result = await runFfmpeg(buildUniqueArgs(source, out, composePresets(parts)));
      expect(result.code, result.stderr.slice(-200)).toBe(0);
      hashes.add(
        createHash("md5")
          .update(await readFile(out))
          .digest("hex"),
      );
      await rm(out, { force: true });
    }
    expect(hashes.size).toBe(100);
  }, 90_000);

  it("metadataStrip удаляет метаданные (title)", async () => {
    const withMeta = join(dir, "meta.mp4");
    const stripped = join(dir, "stripped.mp4");
    await runFfmpeg([
      "-i",
      source,
      "-c",
      "copy",
      "-metadata",
      "title=AVASTUDIO_SECRET",
      "-y",
      withMeta,
    ]);
    await runFfmpeg(buildUniqueArgs(withMeta, stripped, composePresets([metadataStrip()])));

    const readTitle = async (file: string): Promise<string> => {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format_tags=title",
        "-of",
        "default=nw=1:nk=1",
        file,
      ]);
      return stdout.trim();
    };
    expect(await readTitle(withMeta)).toBe("AVASTUDIO_SECRET");
    expect(await readTitle(stripped)).toBe("");
  });
});
