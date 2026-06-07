/**
 * Процессор очереди `warmup-account` (TASK 12.5). Ежедневная сессия прогрева аккаунта:
 * вычисляет день прогрева по warmup_started_at, строит рандомизированный план действий
 * с эскалацией (день 1 — минимум, день 14 — почти полная активность), «исполняет» его
 * (Фаза 1 — mock-лог), продвигает warmup_stage в БД. Реальные действия в приложении —
 * драйвер платформы (12.4), Фаза 2.
 */
import { jobSchemas, type JobData } from "@avastudio/queue";
import {
  WARMUP_TOTAL_DAYS,
  isWarmedUp,
  planWarmupSession,
  warmupDay,
  type WarmupRepository,
  type WarmupState,
} from "@avastudio/shared/social";

import type { SocialAccountId } from "@avastudio/shared";
import type { Logger } from "@avastudio/shared";
import type { Job } from "bullmq";

/** Контекст процессора прогрева (инъектируется; в тестах — in-memory repo). */
export interface WarmupProcessorContext {
  warmupRepo: WarmupRepository;
  logger: Logger;
  /** Источник «сейчас» (для детерминированных тестов эскалации). */
  now?: () => Date;
}

export interface WarmupResult {
  accountId: string;
  day: number;
  stage: number;
  actions: number;
  warmedUp: boolean;
}

/** Процессор очереди `warmup-account`. */
export function createWarmupProcessor(ctx: WarmupProcessorContext) {
  return async function warmupAccount(job: Job): Promise<WarmupResult> {
    const data: JobData<"warmup-account"> = jobSchemas["warmup-account"].parse(job.data);
    const accountId = data.accountId as SocialAccountId;
    const now = (ctx.now ?? (() => new Date()))();

    const existing = await ctx.warmupRepo.get(accountId);
    if (existing === undefined) {
      throw new Error(`warmup-account: аккаунт ${accountId} не найден (создаётся в ЭТАПЕ 4)`);
    }
    // Первый запуск — фиксируем старт прогрева.
    const startedAt = existing.warmupStartedAt ?? now;
    const day = warmupDay(startedAt, now);
    const plan = planWarmupSession(existing.platform, day);

    // Фаза 1 — действия не исполняются в приложении, только план/лог.
    ctx.logger.info(
      { queue: "warmup-account", jobId: job.id, accountId, day, actions: plan.actions.length, durationMs: plan.durationMs },
      "Сессия прогрева спланирована",
    );

    const next: WarmupState = {
      ...existing,
      warmupStartedAt: startedAt,
      // Стадия только растёт (не откатывается при повторных запусках в тот же день).
      warmupStage: Math.max(existing.warmupStage, day),
    };
    await ctx.warmupRepo.save(next);

    return {
      accountId,
      day,
      stage: next.warmupStage,
      actions: plan.actions.length,
      warmedUp: isWarmedUp(next),
    };
  };
}

export { WARMUP_TOTAL_DAYS };
