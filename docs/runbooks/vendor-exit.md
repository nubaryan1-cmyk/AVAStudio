# Runbook — Vendor exit-drill (ЭТАП 22.4)

Главная защита от vendor lock-in: любой критичный провайдер заменяем за <1 рабочий день,
в идеале — сменой конфига. Всё построено на абстракциях с ≥2 драйверами на каждую роль.

## Принцип
Бизнес-код вызывает абстракцию (PhonePool / ProxyManager / PaymentProviderRegistry /
AI-registry), а не конкретного вендора. Переключение = смена порядка драйверов/ключей
в конфиге (Doppler/env), без правки кода.

## Критичные вендоры и их замена
| Роль        | Активный        | Резерв(ы)              | Как переключить |
|-------------|-----------------|------------------------|-----------------|
| Телефоны    | DuoPlus         | GeeLark                | `PHONE_PROVIDER_PRIORITY` / убрать ключ DuoPlus → PhonePool failover |
| Прокси      | Bright Data     | IPRoyal/Smartproxy     | `PROXY_PROVIDER_PRIORITY` / креды второго в Doppler |
| Платежи     | Stripe          | Paddle/LemonSqueezy/крипто | `PAYMENT_PROVIDER` в Doppler |
| AI image    | OpenAI          | Replicate (+mock)      | убрать/добавить ключ → fallback chain |
| AI video    | Runway          | Luma (+mock)           | убрать/добавить ключ |
| AI audio    | ElevenLabs      | Cartesia (+mock)       | убрать/добавить ключ |
| AI music    | Suno            | Udio (+mock)           | убрать/добавить ключ |
| Хостинг WK  | Fly.io          | Hetzner/Fargate        | пересборка образа (OCI), смена раннера |
| Секреты     | Doppler         | Infisical              | реимпорт секретов |

## Процедура drill (на staging)
1. Для каждой роли: выключить активного провайдера (убрать ключ/пометить unhealthy в конфиге).
2. Прогнать ключевой сценарий (постинг через телефон+прокси; оплата; AI-генерация).
3. Убедиться, что система автоматически (failover) или сменой конфига перешла на резерв.
4. Замерить время переключения (цель <1 день; для конфиг-свитчей — минуты).
5. Вернуть активного, зафиксировать результат в журнале.

## Проверено автоматическими тестами
- Телефоны: failover DuoPlus→GeeLark (`phones/drivers/geelark.test.ts`).
- Прокси: failover Bright Data→IPRoyal + sticky (`proxies/drivers/real-proxies.test.ts`).
- AI: fallback chain provider→mock (`ai/drivers/ai-real.test.ts`).
- Платежи: единый реестр, активный провайдер из конфига (`payments`).

## Расписание
Quarterly exit-drill — запланировать повторяющееся напоминание (раз в 90 дней):
прогнать эту процедуру на staging, обновить таблицу времён переключения.
