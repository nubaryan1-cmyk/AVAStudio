import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { jobSchemas, type JobData } from "@avastudio/queue";
import { NotFoundError } from "@avastudio/shared";

import { assertExit, seedFromString, type ProcessorContext } from "./shared.js";

import type { Job } from "bullmq";


export interface UniqueMediaResult {
  variantIds: string[];
}

/**
 * Процессор очереди `unique-media`. Генерирует N уникальных вариантов исходного ассета
 * (каждый со своим сидом → детерминирован и воспроизводим) и пишет media_variants.
 * Прогресс публикуется по мере готовности вариантов.
 */
export function createUniqueMediaProcessor(ctx: ProcessorContext) {
  return async function uniqueMedia(job: Job): Promise<UniqueMediaResult> {
    const data: JobData<"unique-media"> = jobSchemas["unique-media"].parse(job.data);
    const { logger, pipeline, repo, outputDir } = ctx;

    const asset = await repo.getAsset(data.sourceAssetId);
    if (!asset) {
      throw new NotFoundError({
        internalMessage: `media asset ${data.sourceAssetId} не найден`,
        details: { sourceAssetId: data.sourceAssetId },
      });
    }
    const sourcePath = asset.storagePath;

    await job.updateProgress(2);
    const probeData = await pipeline.probe(sourcePath);
    const baseSeed = seedFromString(`${data.sourceAssetId}:${data.variants}`);
    const variantIds: string[] = [];

    for (let i = 0; i < data.variants; i += 1) {
      const variantId = randomUUID();
      const outputPath = join(outputDir, data.orgId, `${variantId}.mp4`);
      await mkdir(dirname(outputPath), { recursive: true });

      const result = await pipeline.uniquify(sourcePath, outputPath, {
        seed: baseSeed + i,
        durationSec: probeData.durationSec,
      });
      assertExit(result.exitCode, `uniquify[${i}]`);

      await repo.insertVariant({
        id: variantId,
        orgId: data.orgId,
        sourceId: data.sourceAssetId,
        platform: null,
        outputPath,
      });
      variantIds.push(variantId);
      await job.updateProgress(Math.round(((i + 1) / data.variants) * 100));
    }

    logger.info(
      { queue: "unique-media", jobId: job.id, count: variantIds.length },
      "unique-media готов",
    );
    return { variantIds };
  };
}
