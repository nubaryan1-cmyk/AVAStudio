# syntax=docker/dockerfile:1
# Worker-образ AVAStudio (TASK 18.2): Node 20 + FFmpeg (static BtbN) + Chromium (Playwright).
# Multi-stage: builder собирает монорепо и «выкусывает» воркер через `pnpm deploy`,
# runtime — slim-образ только с прод-зависимостями и системными бинарями.

# ---------- base ----------
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.34.1 --activate
WORKDIR /repo

# ---------- builder ----------
FROM base AS builder
# Полный install по lockfile + сборка только воркера и его зависимостей.
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@avastudio/worker
# Standalone-бандл воркера (dist + прод node_modules, развёрнутые workspace-пакеты).
RUN pnpm --filter=@avastudio/worker deploy --prod --legacy /app

# ---------- ffmpeg (static, BtbN — лицензионно как ЭТАП 6.1) ----------
FROM base AS ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends xz-utils && rm -rf /var/lib/apt/lists/*
ADD https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz /tmp/ffmpeg.tar.xz
RUN mkdir -p /opt/ffmpeg && tar -xf /tmp/ffmpeg.tar.xz -C /opt/ffmpeg --strip-components=1

# ---------- runtime ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
# Системные зависимости Chromium (Playwright) + шрифты + утилиты для рендера.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation fonts-noto-color-emoji fonts-noto-cjk \
      ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*

# FFmpeg/ffprobe из статической сборки.
COPY --from=ffmpeg /opt/ffmpeg/bin/ffmpeg  /usr/local/bin/ffmpeg
COPY --from=ffmpeg /opt/ffmpeg/bin/ffprobe /usr/local/bin/ffprobe

ENV FFMPEG_PATH=/usr/local/bin/ffmpeg \
    FFPROBE_PATH=/usr/local/bin/ffprobe \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY --from=builder /app /app

# Non-root.
RUN addgroup --system --gid 1001 avs && adduser --system --uid 1001 --ingroup avs avs \
    && chown -R avs:avs /app
USER avs

EXPOSE 4001
# Health-сервер воркера слушает 4001 (/health).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# dumb-init — корректная пересылка сигналов (graceful shutdown, ЭТАП 7.2).
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
