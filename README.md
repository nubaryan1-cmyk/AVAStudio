# AVAStudio

Платформа управления контентом и публикациями для нескольких аккаунтов
(Instagram, TikTok, Reddit, Threads).

Монорепо: Turborepo + pnpm. Полный план разработки — в "Карта проекта".

## Старт (локально)

```bash
pnpm install
pnpm dev        # web на http://localhost:3000 + worker
pnpm build      # сборка всех приложений
pnpm typecheck  # проверка типов
```

## Структура

- `apps/web` — Next.js 14 (App Router, TypeScript, Tailwind)
- `apps/worker` — Node-воркер (FFmpeg / постинг — добавляется на следующих этапах)
- `packages/db` — Drizzle ORM + миграции
- `packages/shared` — общие типы, утилиты, Zod-схемы
- `packages/ui` — UI-компоненты
- `packages/config` — общие конфиги
- `packages/queue` — BullMQ-определения
