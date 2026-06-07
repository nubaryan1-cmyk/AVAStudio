/**
 * Связь сгенерированного аудио с media-пайплайном (TASK 11.4, пресет audioReplace
 * из TASK 6.3). Слой shared не зависит от пакета media — поэтому здесь только
 * подготовка пути/входа, который воркер передаёт в `audioReplace(replacementPath)`.
 */
import type { AiAsset } from "../../types.js";

/**
 * Возвращает путь/URL аудио-ассета для передачи в media-пресет audioReplace.
 * data-URI (mock) требует материализации в файл воркером (Фаза реальной интеграции),
 * поэтому здесь он отклоняется явной ошибкой — путь должен быть файловым/URL.
 */
export function audioAssetToReplacementPath(asset: AiAsset): string {
  if (asset.kind !== "audio") {
    throw new Error(`audioReplace: ожидался аудио-ассет, получен "${asset.kind}"`);
  }
  if (asset.url.startsWith("data:")) {
    throw new Error("audioReplace: data-URI нужно сначала материализовать в файл");
  }
  return asset.url;
}
