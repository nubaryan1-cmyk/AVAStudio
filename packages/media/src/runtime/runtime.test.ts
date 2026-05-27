import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runFfmpeg } from "../ffmpeg/runner.js";

import { collectRenderMetrics } from "./metrics.js";
import { classifyExit, shouldRetry } from "./retry.js";
import { createConcurrencyLimiter, runFfmpegSandboxed, withTempDir } from "./sandbox.js";

describe("retry (классификация exit-кодов)", () => {
  it("0 — успех, не ретрай", () => {
    expect(classifyExit(0)).toEqual({ retry: false, reason: "success" });
  });
  it("137 (OOM) — ретрай с меньшим разрешением", () => {
    expect(classifyExit(137)).toMatchObject({ retry: true, adjust: "lower-resolution" });
  });
  it("143 (таймаут) — ретрай с бОльшим таймаутом", () => {
    expect(classifyExit(143)).toMatchObject({ retry: true, adjust: "increase-timeout" });
  });
  it("1 (invalid data) — НЕ ретраить", () => {
    expect(classifyExit(1).retry).toBe(false);
  });
  it("прочее — транзиент, ретрай", () => {
    expect(classifyExit(69).retry).toBe(true);
  });
  it("shouldRetry учитывает номер попытки", () => {
    expect(shouldRetry(69, 1, 3)).toBe(true);
    expect(shouldRetry(69, 3, 3)).toBe(false);
    expect(shouldRetry(1, 1, 3)).toBe(false);
  });
});

describe("withTempDir (cleanup всегда)", () => {
  it("удаляет папку после успеха", async () => {
    let captured = "";
    await withTempDir("ok", async (dir) => {
      captured = dir;
      await writeFile(join(dir, "f.txt"), "x");
    });
    await expect(stat(captured)).rejects.toThrow();
  });
  it("удаляет папку при ошибке", async () => {
    let captured = "";
    await expect(
      withTempDir("err", async (dir) => {
        captured = dir;
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    await expect(stat(captured)).rejects.toThrow();
  });
});

describe("createConcurrencyLimiter", () => {
  it("не превышает лимит параллелизма", async () => {
    const run = createConcurrencyLimiter(2);
    let active = 0;
    let peak = 0;
    const task = () =>
      run(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 20));
        active -= 1;
      });
    await Promise.all([task(), task(), task(), task(), task()]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});

describe("runFfmpegSandboxed (реальный ffmpeg)", () => {
  let dir: string;
  let source: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "avastudio-rt-"));
    source = join(dir, "src.mp4");
    await runFfmpeg([
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=2:size=320x240:rate=10",
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

  it("таймаут убивает зависший процесс (timedOut, code 143)", async () => {
    // долгий энкод (30с источник, libx264) с крошечным таймаутом
    const out = join(dir, "killed.mp4");
    const res = await runFfmpegSandboxed(
      [
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=30:size=640x480:rate=25",
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-y",
        out,
      ],
      { timeoutMs: 150 },
    );
    expect(res.timedOut).toBe(true);
    expect(res.code).toBe(143);
  }, 20_000);

  it("битый вход → ненулевой code, процесс не падает (без throw)", async () => {
    const res = await runFfmpegSandboxed(["-i", "/no/such/file.mp4", "-y", join(dir, "x.mp4")], {
      timeoutMs: 10_000,
    });
    expect(res.timedOut).toBe(false);
    expect(res.code).not.toBe(0);
    expect(shouldRetry(res.code, 1)).toBe(false); // invalid data → не ретраить
  }, 20_000);

  it("collectRenderMetrics собирает метрики реального рендера", async () => {
    const out = join(dir, "m.mp4");
    const startedAt = Date.now();
    const r = await runFfmpegSandboxed(["-i", source, "-c:v", "mpeg4", "-y", out], {
      timeoutMs: 10_000,
    });
    const finishedAt = Date.now();
    const metrics = await collectRenderMetrics({
      inputDurationSec: 2,
      startedAt,
      finishedAt,
      outputPath: out,
      presetChain: ["brightness", "crop"],
      exitCode: r.code,
      encoder: "mpeg4",
    });
    expect(metrics.outputSizeBytes).toBeGreaterThan(0);
    expect(metrics.outputResolution).toBe("320x240");
    expect(metrics.encoder).toBe("mpeg4");
    expect(metrics.presetChain).toEqual(["brightness", "crop"]);
    expect(metrics.renderDurationMs).toBeGreaterThanOrEqual(0);
  }, 20_000);
});
