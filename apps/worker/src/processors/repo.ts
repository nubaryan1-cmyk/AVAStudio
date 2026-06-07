import { mediaVariants, renderMetrics, mediaAssets, type Database } from "@avastudio/db";
import { eq } from "drizzle-orm";

/** Значения enum `platform` в БД. */
export type PlatformValue = "instagram" | "tiktok" | "reddit" | "threads" | "youtube" | "x";

export interface AssetRow {
  storagePath: string;
  durationSec: number | null;
  orgId: string;
}

export interface VariantInsert {
  id: string;
  orgId: string;
  sourceId: string;
  platform: PlatformValue | null;
  outputPath: string;
}

export interface MetricsInsert {
  contentJobId: string;
  jobId: string | null;
  inputDurationSec: number;
  renderDurationMs: number;
  outputSizeBytes: number;
  outputResolution: string;
  presetChain: string[];
  exitCode: number;
  encoder: string;
  workerId: string;
}

/**
 * Узкий интерфейс доступа к БД для процессоров. Прячет Drizzle за тремя методами,
 * чтобы процессоры были тестируемы фейком без живого Postgres.
 */
export interface ProcessorRepo {
  getAsset(id: string): Promise<AssetRow | null>;
  insertVariant(variant: VariantInsert): Promise<void>;
  /** Идемпотентная запись метрик: затирает прежние метрики этого contentJob и пишет новые. */
  replaceMetrics(metrics: MetricsInsert): Promise<void>;
}

/** Реальная реализация репозитория поверх Drizzle/Postgres. */
export function createDbRepo(db: Database): ProcessorRepo {
  return {
    async getAsset(id) {
      const rows = await db
        .select({
          storagePath: mediaAssets.storagePath,
          durationSec: mediaAssets.durationSec,
          orgId: mediaAssets.orgId,
        })
        .from(mediaAssets)
        .where(eq(mediaAssets.id, id))
        .limit(1);
      return rows[0] ?? null;
    },

    async insertVariant(variant) {
      await db.insert(mediaVariants).values(variant);
    },

    async replaceMetrics(metrics) {
      await db.delete(renderMetrics).where(eq(renderMetrics.contentJobId, metrics.contentJobId));
      await db.insert(renderMetrics).values(metrics);
    },
  };
}
