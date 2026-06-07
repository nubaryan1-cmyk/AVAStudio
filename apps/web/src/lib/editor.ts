import type { ProfileId } from "@avastudio/media";

/** Человекочитаемые названия пресетов уникализации (ЭТАП 6.3). */
export const PRESET_LABELS: Record<string, string> = {
  brightness: "Яркость",
  contrast: "Контраст",
  saturation: "Насыщенность",
  hue: "Оттенок",
  crop: "Кроп",
  rotate: "Поворот",
  addNoise: "Шум",
  vignette: "Виньетка",
  sharpen: "Резкость",
  mirror: "Зеркало",
  endFreeze: "Стоп-кадр в конце",
  overlayLogo: "Оверлей",
  speedUp: "Ускорение",
  audioPitch: "Питч аудио",
  metadataStrip: "Очистка метаданных",
  containerRemux: "Ремукс контейнера",
};

export const PROFILE_LABELS: Record<ProfileId, string> = {
  "instagram-reels": "Instagram Reels",
  "instagram-feed-4-5": "Instagram Feed 4:5",
  "instagram-feed-1-1": "Instagram Feed 1:1",
  tiktok: "TikTok",
  reddit: "Reddit",
  threads: "Threads",
};

export type RenderStatus = "queued" | "active" | "completed";

export function statusLabel(status: RenderStatus): string {
  switch (status) {
    case "queued":
      return "В очереди";
    case "active":
      return "Рендер…";
    case "completed":
      return "Готово";
  }
}

export function presetLabel(id: string): string {
  return PRESET_LABELS[id] ?? id;
}
