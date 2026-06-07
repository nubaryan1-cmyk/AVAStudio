# Legacy reference: services/uploader (Playwright IG-аплоадер)

> Только для чтения. Источник: `D:\FFMPEG\services\uploader\` (Python/Playwright).
> Здесь зафиксированы ценные приёмы, перенесённые в каркас browser-драйвера
> Instagram/TikTok (`packages/shared/src/social/drivers/instagram/browser-skeleton.ts`).
> Реальная реализация — Фаза 2 (ЭТАП 22).

## Файлы legacy
- `playwright_upload.py` — заливка Reels через instagram.com (desktop web).
- `playwright_login.py` — логин, storage_state (cookie-jar), resume сессии.
- `playwright_warmup.py` — прогрев (референс для TASK 12.5).
- `config.py`, `logger.py`, `bridge.py`, `caption.json`.

## Ценные приёмы (перенесены в каркас)
1. **Desktop, не mobile.** У IG mobile web нет полноценного create flow («Use the
   app»). Нужен DESKTOP viewport 1280×800 + desktop User-Agent. Заливка только на
   `www.instagram.com`, не на `m.instagram.com`.
2. **Resume сессии.** Сохранять/переиспользовать `storage_state` (cookies). Сначала
   `goto(HOME_URL)` и проверка `is_logged_in`; полный логин — только если сессия
   невалидна. Снижает частоту логинов → меньше триггеров анти-фрода.
3. **Клик Create (+) — несколько стратегий.** IG часто меняет селекторы:
   `svg[aria-label="New post"]`, `svg[aria-label="Create"]`,
   `role=button name="New post"`, `a[href*="/create/"]`; fallback — прямой переход
   на `/create/select/`.
4. **Submenu Post/Reel.** Иногда после Create появляется меню типа поста — выбрать
   Post/Reel.
5. **Загрузка файла.** Сначала `expect_file_chooser` вокруг клика «Select from
   computer»; fallback — `input[type="file"].set_input_files(...)`.
6. **Диалог Reel.** После загрузки IG может показать «video will be shared as a
   Reel» — закрыть кнопкой OK/Okay/Continue.
7. **Шаги Crop → Edit → Caption.** Жать Next с ОЖИДАНИЕМ появления кнопки (до ~25с
   на первом шаге, ~8с на последующих); 3–4 итерации с запасом.
8. **Caption — contenteditable.** Поле — `div[contenteditable=true][role=textbox]`
   (несколько вариантов селекторов), ввод с задержкой между символами (имитация
   человека).
9. **Share.** Кнопка `Share`/`Share now` по role, с ожиданием и fallback на
   текстовый локатор.
10. **Закрытие пост-логин диалогов.** Save Login Info / Notifications — кнопки
    «Not Now»/«Не сейчас» в цикле.

## Что НЕ переносим в каркас
- Жёстко зашитые креды/пути из `config.py` — в новой системе берутся из
  зашифрованного хранилища (ЭТАП 2) и ProxyManager (sticky-прокси per account).
- Однопользовательский сценарий — заменяется multi-account scheduler (TASK 12.7).
