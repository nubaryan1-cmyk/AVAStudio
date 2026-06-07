# Runbook — Google Cloud + OAuth (ЭТАП 20)

## 20.1 — Проект + billing + alerts
1. Создать проект `avastudio-prod` в GCP, привязать billing-аккаунт.
2. Budgets & alerts: бюджет + пороги уведомлений **$100 / $500 / $1000**.
3. Включить API: **YouTube Data API v3**, OAuth (по умолчанию), (опц.) **Vertex AI**, Cloud Storage.
4. Service accounts (least privilege):
   - `youtube-oauth` — без широких прав (OAuth идёт от имени юзера).
   - `vertex-ai-runner` — роль `roles/aiplatform.user` (только если используешь Gemini).
   Ключи service account → Doppler (`GOOGLE_APPLICATION_CREDENTIALS` как JSON или путь).

## 20.2 — OAuth 2.0 (YouTube)
1. APIs & Services → Credentials → **OAuth Client ID** (тип: Web application).
2. Authorized redirect URI: `https://app.avastudio.com/api/oauth/google/callback`
   (+ preview-домены при необходимости).
3. OAuth consent screen: заполнить, добавить scopes
   `https://www.googleapis.com/auth/youtube.upload` и `.../youtube.readonly`.
   Запустить **verification** (обязательно для prod-доступа к чужим каналам).
4. Ключи → Doppler: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
   `GOOGLE_OAUTH_REDIRECT_URI`.

## 20.3 — Vertex AI / Gemini (опционально)
1. Включить Vertex AI API, service account `vertex-ai-runner` (`aiplatform.user`).
2. Ключи → Doppler: `GEMINI_API_KEY` (или ADC через service account).

## Безопасность
- `refresh_token` пользователя шифруется (ЭТАП 2/3, `encryptJSON` DEK организации) перед сохранением.
- Service-account ключи — только сервер/worker, не на фронт.
