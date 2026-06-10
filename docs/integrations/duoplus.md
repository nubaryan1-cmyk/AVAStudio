# DuoPlus — интеграция облачных телефонов (TASK 22.1)

Драйвер: `packages/shared/src/phones/drivers/duoplus.ts` (реализует `PhoneProvider`).
Это **один из** провайдеров — failover на аналог (GeeLark/MoreLogin) делает `PhonePool` (22.2).

## Доступ к API
- Ключ: консоль DuoPlus → **Automation → API** (`https://my.duoplus.net/api`). Хранится в Doppler как `DUOPLUS_API_KEY`, наружу не логируется.
- Домен: **`https://openapi.duoplus.net`**
- Метод: **POST** на всех эндпоинтах; тело — JSON.
- Заголовки: `DuoPlus-API-Key`, `Content-Type: application/json`, `Lang: en|ru|zh|zh-TW`.
- Лимит: **QPS = 1 на каждый интерфейс** (учтено rate-limit'ом в коде воркера).
- Конверт ответа: `{ "code": 200, "data": {...}, "message": "Success" }` (code≠200 → ошибка; 401 — нужен релогин).

## Маппинг эндпоинтов (драйвер → API)
| Метод драйвера | Эндпоинт | Примечание |
| --- | --- | --- |
| `listDevices` / `getStatus` | `POST /api/v1/cloudPhone/list` | пагинация (page/pagesize ≤100); статус в `data.list[].status` (int) |
| `executeAction` (tap/swipe/type/launch/screenshot) | `POST /api/v1/cloudPhone/command` | ADB shell без префикса `adb shell`; команды ≤10 c |
| `installApp` | `POST /api/v1/application/batchInstall` | `app_id` из List of Platform/Team App |
| `rentDevice` | `POST /api/v1/cloudPhone/buy` | **платно** |
| `releaseDevice` (power off) | `POST /api/v1/cloudPhone/powerOff` | `image_ids` |
| power on | `POST /api/v1/cloudPhone/powerOn` | `image_ids` |

> Подтверждены на боевом ключе: `/list` и `/command`. Остальные (buy/powerOn/powerOff/batchInstall)
> следуют единому паттерну `/api/v1/...`; проверяются перед первым боевым вызовом.

## Статусы устройства (int → DeviceState)
`0` не сконфигурирован → offline · `1` включён → rented · `2` выключен → available ·
`3` истёк / `4` просрочено продление / `11` конфигурируется → offline · `10` включается → rented ·
`12` ошибка конфигурации → error.

## Экран устройства (live-просмотр)
Отдельного screenshot-эндпоинта в API нет. Кадр получаем через ADB:
```
screencap -p /sdcard/_ava.png >/dev/null 2>&1; base64 /sdcard/_ava.png
```
base64-PNG приходит в `data.content` → декодируется в изображение (поток кадров = live-экран
в device-вкладке сайта). Для интерактивного просмотра/управления оператором — функция
**Share Cloud Phone** (web-ссылка) или десктоп-клиент DuoPlus.

## ADB-управление
Перед `command` ADB должен быть включён на телефоне: **Batch Enable ADB**
(`/api/v1/cloudPhone/...`) или тумблер ADB в консоли. Человекоподобные касания/свайпы
(вариативная площадь/скорость/точки) формирует модуль поведения воркера, драйвер исполняет
примитивы `input tap/swipe/text`, запуск приложения — `monkey -p <pkg> ... 1`.

## Предусловия боевого цикла (rent→прокси→install→login→post)
1. Устройство арендовано (есть в `/list`).
2. **Прокси настроен** на телефоне (Proxy Init / в консоли) — без него статус 0 и телефон не включается. Residential-прокси — ЭТАП 22.3.
3. ADB включён.
4. Целевое приложение установлено (`installApp` или предустановка).
5. Аккаунт залогинен (через UI-автоматизацию ADB).
