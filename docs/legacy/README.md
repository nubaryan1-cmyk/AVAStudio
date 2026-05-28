# Legacy-источники (read-only справка)

Эти файлы скопированы из старого `D:\FFMPEG\panel\` и `\work\` как референс для миграции в
`packages/media/src/legacy/` (TASK 7.3). НЕ редактировать — это снимок прошлой версии.

| Файл              | Что взято в media                                       |
| ----------------- | ------------------------------------------------------- |
| FULL_AUTO.js      | trim-split + speedup; multi-file conveyor               |
| run_make.ps1      | zoom без чёрных полей; fps-jitter; fake-device metadata |
| convert_logic.ps1 | (покрыто профилями 6.4)                                 |
| panel-server.js   | (UI/HTTP — заменяется новым приложением)                |

Все ценные «магические числа» (пулы устройств, диапазоны сдвигов, скорость) перенесены с
ссылками на строки оригиналов в `packages/media/src/legacy/*.ts`.
