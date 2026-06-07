export type PostStatus = "scheduled" | "posting" | "posted" | "failed";

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  scheduled: "Запланирован",
  posting: "Публикуется",
  posted: "Опубликован",
  failed: "Ошибка",
};

export const PRIME_START = 18;
export const PRIME_END = 22;

/** Локальный час публикации внутри прайм-тайма (18:00–22:00). */
export function isPrimeTime(hour: number): boolean {
  return hour >= PRIME_START && hour < PRIME_END;
}

export function postStatusLabel(status: PostStatus): string {
  return POST_STATUS_LABELS[status];
}
