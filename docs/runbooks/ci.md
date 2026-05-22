# CI / GitHub Actions

## Workflows

- `.github/workflows/ci.yml` — на каждый push и PR в `main`. Matrix-джоб запускает 4 проверки параллельно:
  `lint`, `typecheck`, `test`, `build`. Каждая: checkout → pnpm → Node 20 (cache pnpm) → `pnpm install --frozen-lockfile` → `pnpm <task>`. Turbo-кэш через `actions/cache` по `.turbo`. Concurrency отменяет устаревшие запуски на той же ветке.
- `.github/workflows/codeql.yml` — статический анализ безопасности (JS/TS) на push/PR в main + еженедельно. Требует включённого Code scanning в настройках репозитория (для приватных репо — GitHub Advanced Security).

## Что сделать на GitHub (один раз, вручную)

1. Создать репозиторий и запушить ветку `main`.
2. Settings → Branches → Branch protection rule для `main`:
   - Require a pull request before merging (reviews ≥ 1).
   - Require status checks to pass before merging → выбрать: **lint**, **typecheck**, **test**, **build**.
   - Require branches to be up to date before merging.
   - Do not allow force pushes / deletions.
3. (Опц.) Settings → Code security → включить Code scanning (CodeQL).

После этого PR с падающим CI физически нельзя замержить.

## Локальная проверка (эквивалент CI)

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
