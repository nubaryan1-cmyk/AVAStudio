# Интеграция DuoPlus (ЭТАП 22.1)

Облачные Android-телефоны для постинга/варминга. Драйвер реализует `PhoneProvider`
(ЭТАП 12.2) — ОДИН из провайдеров, не привязка (failover на GeeLark — 22.2).

## Аутентификация
- Получить ключ: DuoPlus console → Automation → API → API KEY.
- Все запросы — заголовок `DuoPlus-API-Key: <key>`. Ключ → Doppler (`DUOPLUS_API_KEY`),
  наружу/в логи не попадает.

## Маппинг API → PhoneProvider
| Метод интерфейса     | DuoPlus endpoint                         |
|----------------------|------------------------------------------|
| `rentDevice`         | POST `/cloudphone/buy` (Buy Cloud Phone) |
| `listDevices`        | GET  `/cloudphone/list`                  |
| `getStatus`          | GET  `/cloudphone/status?id=`            |
| `installApp`         | POST `/application/batch-install`        |
| `executeAction`      | POST `/cloudphone/adb` (input tap/swipe/text, screencap) |
| `releaseDevice`      | POST `/cloudphone/power-off`             |
| `isHealthy`          | GET  `/cloudphone/list` (ping)           |

## Реселл-модель (важно)
DuoPlus API работает по ОДНОМУ ключу — телефоны покупаются под твой master-аккаунт и
списываются с твоего баланса DuoPlus. Конечный пользователь платит ТЕБЕ (биллinг ЭТАП 9/19),
а в твоей БД хранится маппинг `org_id/user_id → cloud_phone_id`. Пользователь DuoPlus не видит.
Опрос статуса/продление — `/cloudphone/status`, `/cloudphone/renew` (опрашиваем сами, вебхуков нет).

## Полный цикл (Фаза 2, на реальном аккаунте)
аренда (`rentDevice`) → установка приложения (`installApp`) → действия логина/постинга
(`executeAction` через ADB) → проверка (`getStatus`/screenshot). Запускается воркером (ЭТАП 18).

## Безопасность
- Креды/токены соц-аккаунтов на устройстве не задерживаются в памяти/логах (ЭТАП 2/3).
- ADB-команды формируются из нормализованных действий (input tap/swipe/text) — без сырого ввода извне.
