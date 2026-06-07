/**
 * Каркас реального browser-драйвера Instagram (Playwright). Перенос ценных приёмов из
 * legacy D:\FFMPEG\services\uploader\playwright_upload.py (см. docs/legacy/
 * uploader-reference.md). В Фазе 1 НЕ исполняется — реальная реализация в Фазе 2
 * (ЭТАП 22). Метод бросает, пока нет Playwright-окружения и кредов.
 *
 * Ключевые приёмы из legacy, которые здесь зафиксированы как шаги:
 *  - DESKTOP viewport 1280×800 + desktop UA (mobile web не имеет create flow);
 *  - переиспользование storage_state (cookie-jar) для resume сессии;
 *  - клик Create (+) по нескольким стратегиям селекторов (IG часто их меняет),
 *    fallback на прямой URL /create/select/;
 *  - загрузка файла через expect_file_chooser, fallback на input[type=file];
 *  - закрытие диалога «shared as a Reel» (OK/Continue);
 *  - проход шагов Crop → Edit → Caption кликом Next с ожиданием появления;
 *  - caption в contenteditable div (несколько селекторов), ввод с задержкой;
 *  - Share с ожиданием и fallback на текстовый локатор.
 */
import type { MediaRef, PostOptions, PostResult, Session } from "../../types.js";

export interface BrowserDriverConfig {
  /** Путь к storage_state (cookie-jar) для resume. */
  storageStatePath?: string;
  headless?: boolean;
  /** Прокси-endpoint от ProxyManager (sticky per account). */
  proxyUrl?: string;
}

/** Каркас: реальная заливка через Playwright. Фаза 2. */
export async function instagramBrowserPostVideo(
  _session: Session,
  _video: MediaRef,
  _opts: PostOptions | undefined,
  _config: BrowserDriverConfig,
): Promise<PostResult> {
  throw new Error(
    "instagramBrowserPostVideo: реальный Playwright-драйвер доступен в Фазе 2 (ЭТАП 22)",
  );
}
