import { z } from "zod";

import { PLATFORMS, type Platform } from "../domain/enums.js";

import type { SocialAccountId } from "../domain/ids.js";

/**
 * Провайдеро-независимая абстракция соцплатформы (ADR-015, TASK 12.1). Единый
 * интерфейс SocialPlatform, под который пишутся драйверы (12.4). Разные платформы
 * реализуются разным механизмом (api/browser/phone) — это деталь драйвера, скрытая
 * за интерфейсом. Фаза 1 — mock, реальные подключения в Фазе 2.
 */

/** Платформы (зеркало доменного enum). */
export { PLATFORMS };
export type { Platform };

/** Механизм реализации драйвера — как именно драйвер выполняет действия. */
export const IMPL_MECHANISMS = ["api", "browser", "phone"] as const;
export type ImplMechanism = (typeof IMPL_MECHANISMS)[number];

/** Что платформа/драйвер умеет (capabilities-флаги). */
export interface PlatformCapabilities {
  video: boolean;
  photo: boolean;
  carousel: boolean;
  stats: boolean;
  /** Поддерживаемые механизмы (основной + запасные). */
  mechanisms: readonly ImplMechanism[];
}

/** Ссылка на соц-аккаунт (без секретов — креды берёт драйвер из хранилища). */
export interface SocialAccountRef {
  accountId: SocialAccountId;
  platform: Platform;
  handle: string;
}

/** Активная сессия логина (нормализованная). Секрет-токены не логируются. */
export interface Session {
  accountId: SocialAccountId;
  platform: Platform;
  mechanism: ImplMechanism;
  /** Непрозрачный идентификатор сессии драйвера (cookie-jar/device/token-ref). */
  sessionRef: string;
  createdAt: Date;
  expiresAt?: Date;
}

/** Медиа для публикации (ссылка на ассет/файл). */
export interface MediaRef {
  kind: "video" | "image";
  /** Путь/URL готового файла. */
  path: string;
}

/** Опции публикации (общие для всех платформ). */
export const postOptionsSchema = z.object({
  caption: z.string().max(2200).optional(),
  hashtags: z.array(z.string()).optional(),
  /** Запланированное время (для scheduler 12.7). */
  scheduledAt: z.date().optional(),
  /** Предпочитаемый механизм (иначе берётся основной из capabilities). */
  preferMechanism: z.enum(IMPL_MECHANISMS).optional(),
});
export type PostOptions = z.infer<typeof postOptionsSchema>;

/** Нормализованный результат публикации. */
export interface PostResult {
  ok: boolean;
  platform: Platform;
  /** ID поста на платформе (при успехе). */
  externalPostId?: string;
  url?: string;
  mechanism: ImplMechanism;
  /** Причина при ok=false. */
  error?: string;
  postedAt: Date;
}

/** Нормализованная статистика аккаунта. */
export interface AccountStats {
  accountId: SocialAccountId;
  platform: Platform;
  followers: number;
  following: number;
  posts: number;
  /** Средний reach последних постов (для детектора shadowban, 12.6). */
  avgReach?: number;
  fetchedAt: Date;
}

/**
 * Единый интерфейс соцплатформы. Драйвер платформы реализует его поверх своего
 * механизма (api/browser/phone). Все методы провайдеро-независимы.
 */
export interface SocialPlatform {
  readonly platform: Platform;
  readonly capabilities: PlatformCapabilities;
  login(account: SocialAccountRef): Promise<Session>;
  postVideo(session: Session, video: MediaRef, opts?: PostOptions): Promise<PostResult>;
  postPhoto(session: Session, photo: MediaRef, opts?: PostOptions): Promise<PostResult>;
  postCarousel(session: Session, items: readonly MediaRef[], opts?: PostOptions): Promise<PostResult>;
  getStats(account: SocialAccountRef): Promise<AccountStats>;
}
