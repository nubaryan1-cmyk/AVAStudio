# Runbook: ротация ключа шифрования (KEK) без даунтайма

Контекст: ADR-009 (envelope encryption). KEK оборачивает per-org DEK; DEK шифрует данные.
Ротация KEK = перешифровать обёрнутые DEK. Сами cred-блобы НЕ трогаются.

`keyVersion` — монотонная метка (`v1`, `v2`, ...). Текущий ключ = `CURRENT_KEY_VERSION`,
предыдущий — на единицу меньше.

## Шаги

1. **Сгенерировать новый KEK:**

   ```bash
   openssl rand -base64 32
   ```

2. **Перевести ключи (Doppler в проде / .env локально):**

   - `CREDENTIALS_ENCRYPTION_KEY_PREV` ← текущее значение `CREDENTIALS_ENCRYPTION_KEY`
   - `CREDENTIALS_ENCRYPTION_KEY` ← новый ключ

3. **Поднять версию в коде:** в `packages/shared/src/credentials/index.ts` увеличить
   `CURRENT_KEY_VERSION` (например `v1` → `v2`). Задеплоить.
   Теперь система: новые блобы пишет на `v2`, старые (`v1`) расшифровывает через `_PREV`
   (`resolveKekFromEnv` выбирает ключ по версии). **Даунтайма нет** — оба ключа активны.

4. **Batch-ротация обёрнутых DEK:** прогнать по всем записям ключей в БД
   `rotateWrappedDataKey(wrapped)` — каждый DEK, обёрнутый `v1`, переоборачивается на `v2`.
   (cred-блобы, зашифрованные DEK, перешифровывать НЕ нужно.)

5. **Проверка:** убедиться, что не осталось обёрнутых DEK с `keyVersion === v1`.

6. **Завершение:** удалить `CREDENTIALS_ENCRYPTION_KEY_PREV` из Doppler/.env.
   Старый ключ больше нигде не используется.

## Откат

Если на шаге 4 что-то пошло не так — `_PREV` ещё на месте, всё расшифровывается. Можно
вернуть `CURRENT_KEY_VERSION` назад и расследовать. Не удалять `_PREV` до полной проверки (шаг 5).

## Безопасность

- Потеря KEK без бэкапа = потеря данных. KEK бэкапится отдельно от БД (ЭТАП 15).
- Расшифрованные DEK/данные не логировать и не сохранять (см. `logger/redact.ts`).

## Плановая ротация (ЭТАП 15.3)

Ротировать `CREDENTIALS_ENCRYPTION_KEY` по расписанию — раз в 90 дней (quarterly).
Механизм `keyVersion` (выше) делает ротацию безболезненной, поэтому её можно
проводить регулярно, не дожидаясь инцидента.

- Поставить повторяющееся напоминание (календарь команды или scheduled-задача)
  каждые 90 дней: «провести ротацию KEK по этому runbook».
- Те же шаги применимы к `AUTH_JWT_SECRET` (ротация инвалидирует активные сессии —
  планировать на окно с низким трафиком; поддержка `_PREV` для JWT — отдельная задача,
  если потребуется бесшовность).
- После каждой ротации — зафиксировать дату и `CURRENT_KEY_VERSION` в журнале операций.

## Secret scanning (ЭТАП 15.3)

- CI: workflow `.github/workflows/secret-scan.yml` (Gitleaks) — обязательный гейт на PR.
- Локально: `.husky/pre-commit` запускает `gitleaks protect --staged`, если gitleaks
  установлен (`brew install gitleaks` / `scoop install gitleaks`).
- Включить в настройках GitHub-репозитория: **Secret scanning** и **Push protection**
  (Settings → Code security and analysis).
