# Потоки секретов AVAStudio

Два изолированных контура секретов. Подробности и обоснование — в
[ADR-009](../decisions/ADR-009-secrets-architecture.md).

## Контур 1 — App-secrets (ключи приложения)

```mermaid
flowchart LR
  subgraph Source["Источник истины"]
    ENVLOCAL[".env (локально)"]
    DOPPLER["Doppler (prod)"]
  end
  ENVLOCAL --> PROCENV["process.env"]
  DOPPLER --> PROCENV
  PROCENV --> ENVMOD["@avastudio/shared/env\n(Zod-валидация при старте)"]
  ENVMOD -->|типизированный доступ| API["API-роуты (tRPC)"]
  ENVMOD -->|типизированный доступ| WORKER["Worker'ы"]
  ENVMOD -. NEXT_PUBLIC_* .-> FE["Frontend"]
  PROCENV -. прямой доступ запрещён ESLint .-x CODE["Любой код"]
```

## Контур 2 — User-credentials (envelope encryption)

```mermaid
flowchart TB
  KEK["KEK — CREDENTIALS_ENCRYPTION_KEY\n(app-secret, вне БД)"]
  subgraph DB["PostgreSQL"]
    DEKSTORE["Обёрнутые DEK по организациям\n(wrapped DEK + keyVersion)"]
    CREDS["social_accounts.credentials_encrypted\nproxies.credentials_encrypted\n(AES-256-GCM шифртексты)"]
  end
  KEK -->|unwrap| DEK["DEK организации (в памяти worker'а, TTL)"]
  DEKSTORE -->|wrapped| DEK
  DEK -->|decrypt| PLAIN["Пароли / токены / cookies (plaintext)"]
  PLAIN -->|использует только| WORKER["Worker (постинг/телефоны)"]
  PLAIN -. никогда .-x FE["Frontend / обычные API-ответы"]
  PLAIN -. никогда в plaintext .-x LOGS["Логи (redaction)"]
```

## Инвариант безопасности

- БД без KEK → только бесполезные шифртексты.
- KEK без БД → расшифровывать нечего.
- Утечка одного DEK → пострадает максимум одна организация.

## Кто что читает

| Компонент  | App-secrets            | Расшифровка user-credentials |
| ---------- | ---------------------- | ---------------------------- |
| Frontend   | только `NEXT_PUBLIC_*` | никогда                      |
| API (tRPC) | нужные                 | нет (только запись)          |
| Worker'ы   | нужные (scoped)        | да (единственное место)      |
| Логи       | redaction              | redaction                    |
