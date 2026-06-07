import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { createLogger } from "@avastudio/shared";
import { describe, expect, it, vi } from "vitest";

import { createRenderVideoProcessor } from "./render-video.js";
import { createUniqueMediaProcessor } from "./unique-media.js";

import type { MediaPipeline } from "./pipeline.js";
import type { AssetRow, MetricsInsert, ProcessorRepo, VariantInsert } from "./repo.js";
import type { ProcessorContext } from "./shared.js";


const ORG = "11111111-1111-1111-1111-111111111111";
const ASSET = "22222222-2222-2222-2222-222222222222";
const CONTENT_JOB = "33333333-3333-3333-3333-333333333333";

const silent = createLogger({ destination: { write: () => undefined } });

/** Создаёт пустой файл по пути (эмуляция вывода FFmpeg-шага). */
async function touch(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, "");
}

/** Фейк-репозиторий: пишет в память (без Postgres). */
function fakeRepo(asset: AssetRow | null) {
  const variants: VariantInsert[] = [];
  const metrics: MetricsInsert[] = [];
  const repo: ProcessorRepo = {
    getAsset: () => Promise.resolve(asset),
    insertVariant: (v) => {
      variants.push(v);
      return Promise.resolve();
    },
    replaceMetrics: (m) => {
      const idx = metrics.findIndex((x) => x.contentJobId === m.contentJobId);
      if (idx >= 0) metrics.splice(idx, 1);
      metrics.push(m);
      return Promise.resolve();
    },
  };
  return { repo, variants, metrics };
}

/** Фейк-конвейер: не дёргает FFmpeg, но создаёт выходные файлы шагов. */
function fakePipeline(overrides: Partial<MediaPipeline> = {}): MediaPipeline {
  return {
    probe: () =>
      Promise.resolve({
        durationSec: 5,
        sizeBytes: 1000,
        bitrate: 1000,
        streamCount: 2,
        video: { codec: "h264", width: 1080, height: 1920, fps: 30 },
        audio: { codec: "aac", channels: 2 },
      }),
    uniquify: async (_i, o, opts) => {
      opts.onProgress?.(0.5);
      await touch(o);
      return { exitCode: 0, presetChain: ["brightness", "speedUp"] };
    },
    toProfile: async (_i, o) => {
      await touch(o);
      return { exitCode: 0 };
    },
    normalizeAudio: (_i, o) => touch(o),
    watermark: (_i, o) => touch(o),
    collectMetrics: (p) =>
      Promise.resolve({
        inputDurationSec: p.inputDurationSec,
        renderDurationMs: 1200,
        ratio: 0.24,
        outputSizeBytes: 2048,
        outputResolution: "1080x1920",
        presetChain: p.presetChain,
        exitCode: p.exitCode,
        encoder: p.encoder,
      }),
    ...overrides,
  };
}

function fakeJob(data: unknown, id = "job-1") {
  return {
    id,
    data,
    updateProgress: vi.fn().mockResolvedValue(undefined),
  } as unknown as Parameters<ReturnType<typeof createRenderVideoProcessor>>[0];
}

function ctx(pipeline: MediaPipeline, repo: ProcessorRepo): ProcessorContext {
  return { repo, logger: silent, pipeline, outputDir: "/tmp/avastudio-test-variants" };
}

describe("render-video processor", () => {
  const asset: AssetRow = { storagePath: "/tmp/in.mp4", durationSec: 5, orgId: ORG };

  it("проходит probe→render→variant→metrics и пишет в БД", async () => {
    const { repo, variants, metrics } = fakeRepo(asset);
    const job = fakeJob({ orgId: ORG, contentJobId: CONTENT_JOB, sourceAssetId: ASSET });

    const result = await createRenderVideoProcessor(ctx(fakePipeline(), repo))(job);

    expect(result.variantId).toBeTruthy();
    expect(variants).toHaveLength(1);
    expect(variants[0]?.platform).toBe("instagram");
    expect(metrics).toHaveLength(1);
    expect(metrics[0]?.contentJobId).toBe(CONTENT_JOB);
    expect(metrics[0]?.outputResolution).toBe("1080x1920");
    expect(metrics[0]?.presetChain).toContain("profile:instagram-reels");
    expect(metrics[0]?.presetChain).toContain("loudnorm");
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it("идемпотентность метрик: повторный прогон не дублирует render_metrics", async () => {
    const { repo, metrics } = fakeRepo(asset);
    const c = ctx(fakePipeline(), repo);
    await createRenderVideoProcessor(c)(fakeJob({ orgId: ORG, contentJobId: CONTENT_JOB, sourceAssetId: ASSET }));
    await createRenderVideoProcessor(c)(
      fakeJob({ orgId: ORG, contentJobId: CONTENT_JOB, sourceAssetId: ASSET }, "job-2"),
    );
    expect(metrics).toHaveLength(1);
  });

  it("кидает NotFound при отсутствии ассета", async () => {
    const { repo } = fakeRepo(null);
    await expect(
      createRenderVideoProcessor(ctx(fakePipeline(), repo))(
        fakeJob({ orgId: ORG, contentJobId: CONTENT_JOB, sourceAssetId: ASSET }),
      ),
    ).rejects.toThrow(/не найден/);
  });

  it("транзиентный exit-код FFmpeg → ошибка (ретраится BullMQ)", async () => {
    const { repo } = fakeRepo(asset);
    const pipeline = fakePipeline({
      uniquify: () => Promise.resolve({ exitCode: 137, presetChain: [] }),
    });
    await expect(
      createRenderVideoProcessor(ctx(pipeline, repo))(
        fakeJob({ orgId: ORG, contentJobId: CONTENT_JOB, sourceAssetId: ASSET }),
      ),
    ).rejects.toThrow(/exit 137/);
  });

  it("пропускает loudnorm если нет аудио", async () => {
    const { repo, metrics } = fakeRepo(asset);
    const pipeline = fakePipeline({
      probe: () =>
        Promise.resolve({
          durationSec: 5,
          sizeBytes: 1000,
          bitrate: 1000,
          streamCount: 1,
          video: { codec: "h264", width: 1080, height: 1920, fps: 30 },
          audio: null,
        }),
    });
    await createRenderVideoProcessor(ctx(pipeline, repo))(
      fakeJob({ orgId: ORG, contentJobId: CONTENT_JOB, sourceAssetId: ASSET }),
    );
    expect(metrics[0]?.presetChain).not.toContain("loudnorm");
  });
});

describe("unique-media processor", () => {
  const asset: AssetRow = { storagePath: "/tmp/in.mp4", durationSec: 5, orgId: ORG };

  it("генерирует N вариантов и пишет media_variants", async () => {
    const { repo, variants } = fakeRepo(asset);
    const job = fakeJob({ orgId: ORG, sourceAssetId: ASSET, variants: 3 });

    const result = await createUniqueMediaProcessor(ctx(fakePipeline(), repo))(job);

    expect(result.variantIds).toHaveLength(3);
    expect(variants).toHaveLength(3);
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it("валидация job data: variants<1 кидает ошибку", async () => {
    const { repo } = fakeRepo(asset);
    await expect(
      createUniqueMediaProcessor(ctx(fakePipeline(), repo))(
        fakeJob({ orgId: ORG, sourceAssetId: ASSET, variants: 0 }),
      ),
    ).rejects.toThrow();
  });
});
