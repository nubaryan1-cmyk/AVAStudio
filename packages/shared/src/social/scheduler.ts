/**
 * Multi-account scheduler (TASK 12.7). Распределяет N ассетов по M аккаунтам в разное
 * время с учётом: anti-ban лимитов (12.6, посты/день), прайм-тайма по таймзоне
 * аккаунта (utils/datetime), прогретости (12.5, isWarmedUp) и здоровья (не остановлен).
 * Доступность телефонов (PhonePool 12.2) учитывается как фильтр перед постановкой в
 * очередь. Идемпотентность: детерминированный postingJobId по (org,account,asset) —
 * повторный прогон не плодит дубли. Фаза 1 — генерирует posting_jobs (реальный
 * постинг — Фаза 2).
 */
import { createHash } from "node:crypto";

import { fromZonedTime } from "date-fns-tz";

import { formatInTz, type PrimeTimeWindow } from "../utils/datetime.js";

import { isStopped, limitsFor } from "./anti-ban.js";
import { isWarmedUp } from "./warmup.js";

import type { AccountHealth } from "./anti-ban.js";
import type { WarmupState } from "./warmup.js";
import type { Platform } from "../domain/enums.js";
import type { OrgId, SocialAccountId } from "../domain/ids.js";

/** Аккаунт-кандидат на постинг со своим состоянием. */
export interface SchedulableAccount {
  accountId: SocialAccountId;
  platform: Platform;
  /** IANA-таймзона аккаунта (для прайм-тайма). */
  timeZone: string;
  warmup: WarmupState;
  health: AccountHealth;
}

/** Запрос на планирование. */
export interface ScheduleRequest {
  orgId: OrgId;
  assetIds: readonly string[];
  accounts: readonly SchedulableAccount[];
  /** Дата начала планирования (с этого дня ищем прайм-тайм слоты). */
  startDate: Date;
  /** Горизонт планирования в днях (по умолчанию 14). */
  days?: number;
  /** Окно прайм-тайма (по умолчанию 18:00–22:00 локального). */
  primeWindow?: PrimeTimeWindow;
}

/** Запланированная публикация (зеркало posting_jobs). */
export interface PostingJob {
  postingJobId: string;
  orgId: OrgId;
  accountId: SocialAccountId;
  platform: Platform;
  assetId: string;
  scheduledAt: Date;
  status: "scheduled";
}

export interface ScheduleResult {
  jobs: readonly PostingJob[];
  /** Ассеты, которые не удалось разместить (не хватило ёмкости/аккаунтов). */
  unscheduled: readonly string[];
}

const DEFAULT_WINDOW: PrimeTimeWindow = { startHour: 18, endHour: 22 };

/** Детерминированный id публикации — основа идемпотентности. */
export function postingJobId(orgId: OrgId, accountId: SocialAccountId, assetId: string): string {
  return createHash("sha256").update(`${orgId}|${accountId}|${assetId}`).digest("hex").slice(0, 32);
}

/** Аккаунт допущен к постингу: прогрет и не остановлен (checkpoint/ban/disabled). */
export function isEligible(account: SchedulableAccount): boolean {
  return isWarmedUp(account.warmup) && !isStopped(account.health);
}

/** Строит UTC-дату для слота: день (по startDate+offset) + локальный час/минута в tz. */
function slotToUtc(
  startDate: Date,
  dayOffset: number,
  timeZone: string,
  hour: number,
  minute: number,
): Date {
  const dayMs = startDate.getTime() + dayOffset * 86_400_000;
  const dateStr = formatInTz(new Date(dayMs), timeZone, "yyyy-MM-dd");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return fromZonedTime(`${dateStr}T${hh}:${mm}:00`, timeZone);
}

interface AccountCursor {
  account: SchedulableAccount;
  maxPerDay: number;
  /** Слотов уже занято в текущем дне. */
  usedToday: number;
  dayOffset: number;
  index: number;
}

/**
 * Распределяет ассеты по аккаунтам round-robin с учётом лимитов и прайм-тайма.
 * Каждому аккаунту в день выделяется не больше maxPostsPerDay (anti-ban) слотов,
 * равномерно размазанных по окну прайм-тайма; при исчерпании дня — переход на
 * следующий день (в пределах days). Существующие jobId (idempotency) пропускаются.
 */
export function planSchedule(
  req: ScheduleRequest,
  existingJobIds: ReadonlySet<string> = new Set(),
): ScheduleResult {
  const window = req.primeWindow ?? DEFAULT_WINDOW;
  const days = req.days ?? 14;
  const spanHours = Math.max(1, window.endHour - window.startHour);

  const cursors: AccountCursor[] = req.accounts
    .filter(isEligible)
    .map((account, index) => {
      const limit = limitsFor(account.platform).maxPostsPerDay;
      return { account, maxPerDay: limit, usedToday: 0, dayOffset: 0, index };
    });

  const jobs: PostingJob[] = [];
  const unscheduled: string[] = [];

  if (cursors.length === 0) {
    return { jobs, unscheduled: [...req.assetIds] };
  }

  let rr = 0;
  for (const assetId of req.assetIds) {
    let placed = false;
    // Пробуем разместить, обходя аккаунты round-robin; до cursors.length попыток.
    for (let attempt = 0; attempt < cursors.length; attempt += 1) {
      const cursor = cursors[(rr + attempt) % cursors.length];
      if (cursor === undefined) continue;
      // Переполнен день — двигаем курсор на следующий день, пока в горизонте.
      while (cursor.usedToday >= cursor.maxPerDay && cursor.dayOffset < days - 1) {
        cursor.dayOffset += 1;
        cursor.usedToday = 0;
      }
      if (cursor.usedToday >= cursor.maxPerDay) {
        continue; // этот аккаунт исчерпал весь горизонт
      }
      const id = postingJobId(req.orgId, cursor.account.accountId, assetId);
      if (existingJobIds.has(id)) {
        placed = true; // идемпотентность: уже запланировано — не дублируем
        rr = (rr + attempt + 1) % cursors.length;
        break;
      }
      // Слот внутри окна: размазываем по maxPerDay позициям + джиттер по аккаунту.
      const pos = cursor.usedToday;
      const hour = window.startHour + Math.floor((pos * spanHours) / cursor.maxPerDay);
      const minute = (cursor.index * 7 + pos * 13) % 60;
      const scheduledAt = slotToUtc(req.startDate, cursor.dayOffset, cursor.account.timeZone, hour, minute);
      jobs.push({
        postingJobId: id,
        orgId: req.orgId,
        accountId: cursor.account.accountId,
        platform: cursor.account.platform,
        assetId,
        scheduledAt,
        status: "scheduled",
      });
      cursor.usedToday += 1;
      rr = (rr + attempt + 1) % cursors.length;
      placed = true;
      break;
    }
    if (!placed) {
      unscheduled.push(assetId);
    }
  }

  return { jobs, unscheduled };
}

/** Порог постановки в очередь: job запускается за ~5 минут до scheduledAt. */
export const ENQUEUE_LEAD_MS = 5 * 60_000;

/** Готов ли job к постановке в очередь post-* на момент now. */
export function isDueForEnqueue(job: PostingJob, now: Date = new Date()): boolean {
  return job.scheduledAt.getTime() - now.getTime() <= ENQUEUE_LEAD_MS;
}

/** Порт репозитория posting_jobs (адаптер БД/очередь — ЭТАП 4/5). */
export interface PostingJobRepository {
  existingIds(orgId: OrgId): Promise<ReadonlySet<string>>;
  saveAll(jobs: readonly PostingJob[]): Promise<void>;
}

/** In-memory реализация для Фазы 1/тестов (с идемпотентностью по postingJobId). */
export class InMemoryPostingJobRepository implements PostingJobRepository {
  private readonly byId = new Map<string, PostingJob>();

  async existingIds(orgId: OrgId): Promise<ReadonlySet<string>> {
    const ids = new Set<string>();
    for (const job of this.byId.values()) {
      if (job.orgId === orgId) ids.add(job.postingJobId);
    }
    return ids;
  }

  async saveAll(jobs: readonly PostingJob[]): Promise<void> {
    for (const job of jobs) {
      this.byId.set(job.postingJobId, job); // повторный id перезапишет, дубля не будет
    }
  }

  get size(): number {
    return this.byId.size;
  }
}
