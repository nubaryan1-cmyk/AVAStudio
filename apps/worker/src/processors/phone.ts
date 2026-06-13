import type { JobProcessor } from "./index.js";
import type { Logger } from "@avastudio/shared";
import type { Job } from "bullmq";

import { likeBudgetForRun, isQuietHours, humanPause as abPause, LIMITS } from "./antiban.js";

/**
 * Процессор очереди `phone-task` (ЭТАП 22.1, Слой 2). Водит облачный телефон DuoPlus
 * через ADB-команды с человекоподобными таймингами и координатами.
 *  - warmup: открыть Instagram, листать ленту, иногда лайкать (double-tap).
 *  - upload: открыть экран создания поста (базовый сценарий, дорабатывается).
 * Ключ DUOPLUS_API_KEY берётся из окружения воркера (Doppler).
 */

const BASE = "https://openapi.duoplus.net";
const IG_PKG = "com.instagram.android";

function apiKey(): string {
  // eslint-disable-next-line no-process-env
  const k = process.env.DUOPLUS_API_KEY;
  if (!k) throw new Error("DUOPLUS_API_KEY не задан в окружении воркера");
  return k;
}

async function duo<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "DuoPlus-API-Key": apiKey(), "Content-Type": "application/json", Lang: "ru" },
    body: JSON.stringify(body),
  });
  const env = (await res.json().catch(() => ({}))) as { code?: number; data?: T; message?: string };
  if (!res.ok || env.code !== 200) {
    throw new Error(`duoplus ${path}: code ${env.code ?? res.status} ${env.message ?? ""}`.trim());
  }
  return (env.data ?? ({} as T));
}

/** ADB shell без префикса adb shell. */
async function adb(imageId: string, command: string): Promise<string> {
  const data = await duo<{ content?: string }>("/api/v1/cloudPhone/command", { image_id: imageId, command });
  return data.content ?? "";
}

const rnd = (min: number, max: number): number => Math.floor(min + Math.random() * (max - min));
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
/** Пауза с человеческим джиттером. */
const humanPause = (baseMs: number): Promise<void> => sleep(baseMs + rnd(-300, 900));

/** Размер экрана (wm size → "Physical size: 1080x1920"). Фолбэк 1080x1920. */
async function screenSize(imageId: string): Promise<{ w: number; h: number }> {
  const out = await adb(imageId, "wm size");
  const m = /(\d+)x(\d+)/.exec(out);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 1080, h: 1920 };
}

async function ensureAdb(imageId: string): Promise<void> {
  await duo("/api/v1/cloudPhone/openAdb", { image_ids: [imageId] }).catch(() => undefined);
}

async function openInstagram(imageId: string): Promise<void> {
  await adb(imageId, `monkey -p ${IG_PKG} -c android.intent.category.LAUNCHER 1`);
}

/** Свайп ленты вверх со случайной траекторией. */
async function scrollFeed(imageId: string, w: number, h: number): Promise<void> {
  const x = rnd(Math.floor(w * 0.4), Math.floor(w * 0.6));
  const y1 = rnd(Math.floor(h * 0.7), Math.floor(h * 0.8));
  const y2 = rnd(Math.floor(h * 0.25), Math.floor(h * 0.35));
  const dur = rnd(250, 650);
  await adb(imageId, `input swipe ${x} ${y1} ${x + rnd(-20, 20)} ${y2} ${dur}`);
}

/** Двойной тап — лайк текущего поста. */
async function likePost(imageId: string, w: number, h: number): Promise<void> {
  const x = Math.floor(w / 2) + rnd(-40, 40);
  const y = Math.floor(h / 2) + rnd(-60, 60);
  await adb(imageId, `input tap ${x} ${y}`);
  await sleep(rnd(90, 180));
  await adb(imageId, `input tap ${x} ${y}`);
}

export interface PhoneTaskData {
  imageId: string;
  kind: "warmup" | "upload";
  caption?: string;
  assetUrl?: string;
  rounds?: number;
  tzOffsetHours?: number;
}

export function createPhoneTaskProcessor(logger: Logger): JobProcessor {
  return async (job: Job): Promise<unknown> => {
    const { imageId, kind, rounds = 8 } = job.data as PhoneTaskData;
    logger.info({ jobId: job.id, imageId, kind }, "phone-task: старт");
    await ensureAdb(imageId);
    const { w, h } = await screenSize(imageId);

    if (kind === "warmup") {
      // Anti-ban: ночью аккаунт «спит» — никаких действий (AB.5).
      const tzOffset = (job.data as PhoneTaskData).tzOffsetHours ?? 0;
      if (isQuietHours(tzOffset)) {
        logger.info({ jobId: job.id, imageId }, "phone-task: тихие часы — прогрев пропущен");
        return { ok: true, kind, skipped: "quiet_hours" };
      }
      await openInstagram(imageId);
      await abPause(8000); // дождаться загрузки ленты (человеческая пауза)
      // Лайков за прогон — строго 2–4/час (AB.5). Раскидываем по сессии.
      const likeBudget = likeBudgetForRun();
      let likes = 0;
      for (let i = 0; i < rounds; i += 1) {
        await scrollFeed(imageId, w, h);
        await abPause(rnd(4000, 9000)); // дольше смотрим (watch-time — сигнал доверия)
        // лайкаем редко и только в рамках часового бюджета
        if (likes < likeBudget && Math.random() < 0.2) {
          await likePost(imageId, w, h);
          likes += 1;
          await abPause(rnd(3000, 7000));
        }
        await job.updateProgress(Math.round(((i + 1) / rounds) * 100));
      }
      logger.info(
        { jobId: job.id, imageId, rounds, likes, likeBudget, maxPerHour: LIMITS.likesPerHour.max },
        "phone-task: прогрев завершён (anti-ban лимиты)",
      );
      return { ok: true, kind, rounds, likes, likeBudget };
    }

    // upload (базовый сценарий): открыть Instagram и экран создания поста.
    await openInstagram(imageId);
    await humanPause(6000);
    // Открыть экран создания: тап по центру нижней панели (+).
    await adb(imageId, `input tap ${Math.floor(w / 2)} ${h - rnd(40, 90)}`);
    await humanPause(3000);
    logger.info({ jobId: job.id, imageId }, "phone-task: экран заливки открыт (базовый сценарий)");
    return { ok: true, kind, note: "upload базовый сценарий — выбор медиа/публикация дорабатывается" };
  };
}
