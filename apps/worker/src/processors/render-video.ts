import { randomUUID } from "node:crypto";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { withTempDir, type WatermarkConfig, type WatermarkPosition } from "@avastudio/media";
import { jobSchemas, type JobData } from "@avastudio/queue";
import { NotFoundError } from "@avastudio/shared";


import { resolveProfile } from "./pipeline.js";
import { assertExit, profilePlatform, seedFromString, workerId, type ProcessorContext } from "./shared.js";

import type { Job } from "bullmq";

export interface RenderVideoResult {
  variantId: string;
  outputPath: string;
}

/** Читает опциональный watermark-конфиг из preset job'а (логотип задаётся явно). */
function resolveWatermarkFromPreset(preset: Record<string, unknown> | undefined): WatermarkConfig | null {
  const logoPath = preset?.["watermarkLogoPath"];
  if (typeof logoPath !== "string" || logoPath.length === 0) return null;
  return {
    logoPath,
    position: (preset?.["watermarkPosition"] as WatermarkPosition | undefined) ?? "bottom-right",
    opacity: typeof preset?.["watermarkOpacity"] === "number" ? (preset["watermarkOpacity"] as number) : 0.4,
    margin: typeof preset?.["watermarkMargin"] === "number" ? (preset["watermarkMargin"] as number) : 10,
  };
}

/**
 * Процессор очереди `render-video`. End-to-end локально:
 * probe → уникализация → профиль платформы → LUFS → watermark → метрики → запись в БД.
 * Прогресс публикуется через job.updateProgress(). Ошибки FFmpeg классифицируются (TASK 6.8).
 */
export function createRenderVideoProcessor(ctx: ProcessorContext) {
  return async function renderVideo(job: Job): Promise<RenderVideoResult> {
    const data: JobData<"render-video"> = jobSchemas["render-video"].parse(job.data);
    const { logger, pipeline, repo, outputDir } = ctx;

    const asset = await repo.getAsset(data.sourceAssetId);
    if (!asset) {
      throw new NotFoundError({
        internalMessage: `media asset ${data.sourceAssetId} не найден`,
        details: { sourceAssetId: data.sourceAssetId },
      });
    }
    const sourcePath = asset.storagePath;

    await job.updateProgress(5);
    const probeData = await pipeline.probe(sourcePath);
    await job.updateProgress(10);

    const { id: profileId, profile } = resolveProfile(
      typeof data.preset?.["profileId"] === "string" ? (data.preset["profileId"] as string) : undefined,
    );
    const watermarkConfig = resolveWatermarkFromPreset(data.preset);

    const variantId = randomUUID();
    const outputPath = join(outputDir, data.orgId, `${variantId}.mp4`);
    const seed = seedFromString(data.contentJobId);
    const startedAt = Date.now();

    const presetChain = await withTempDir(job.id ?? variantId, async (dir) => {
      const uniquePath = join(dir, "unique.mp4");
      const profilePath = join(dir, "profile.mp4");
      const loudPath = join(dir, "loud.mp4");

      const unique = await pipeline.uniquify(sourcePath, uniquePath, {
        seed,
        durationSec: probeData.durationSec,
        onProgress: (f) => void job.updateProgress(10 + Math.round(f * 30)),
      });
      assertExit(unique.exitCode, "uniquify");
      await job.updateProgress(40);

      const prof = await pipeline.toProfile(uniquePath, profilePath, profileId);
      assertExit(prof.exitCode, "profile");
      await job.updateProgress(60);

      let lastStep = profilePath;
      const chain = [...unique.presetChain, `profile:${profileId}`];
      if (probeData.audio) {
        await pipeline.normalizeAudio(profilePath, loudPath);
        lastStep = loudPath;
        chain.push("loudnorm");
      }
      await job.updateProgress(80);

      await mkdir(dirname(outputPath), { recursive: true });
      if (watermarkConfig) {
        await pipeline.watermark(lastStep, outputPath, watermarkConfig);
        chain.push("watermark");
      } else {
        await copyFile(lastStep, outputPath);
      }
      await job.updateProgress(90);
      return chain;
    });

    const metrics = await pipeline.collectMetrics({
      inputDurationSec: probeData.durationSec,
      startedAt,
      finishedAt: Date.now(),
      outputPath,
      presetChain,
      exitCode: 0,
      encoder: profile.videoCodec,
    });

    await repo.insertVariant({
      id: variantId,
      orgId: data.orgId,
      sourceId: data.sourceAssetId,
      platform: profilePlatform(profileId),
      outputPath,
    });
    await repo.replaceMetrics({
      contentJobId: data.contentJobId,
      jobId: job.id ?? null,
      inputDurationSec: Math.round(metrics.inputDurationSec),
      renderDurationMs: metrics.renderDurationMs,
      outputSizeBytes: metrics.outputSizeBytes,
      outputResolution: metrics.outputResolution,
      presetChain: metrics.presetChain,
      exitCode: metrics.exitCode,
      encoder: metrics.encoder,
      workerId: workerId(),
    });

    await job.updateProgress(100);
    logger.info(
      { queue: "render-video", jobId: job.id, variantId, outputPath, resolution: metrics.outputResolution },
      "render-video готов",
    );
    return { variantId, outputPath };
  };
}
