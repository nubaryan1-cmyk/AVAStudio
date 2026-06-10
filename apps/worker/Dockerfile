# syntax=docker/dockerfile:1
# Worker-образ AVAStudio (TASK 18.2): Node 20 + FFmpeg + Chromium (Playwright).
# FFmpeg ставится из Debian-репозитория (mirror.timeweb.ru) — статический BtbN-билд
# недоступен с этого RU-хоста (GitHub release-CDN 185.199.x таймаутит из РФ).

# ---------- base ----------
FROM node:20-bookworm-slim AS base
RUN printf 'Types: deb\nURIs: http://mirror.timeweb.ru/debian\nSuites: bookworm bookworm-updates\nComponents: main contrib non-free non-free-firmware\nSigned-By: /usr/share/keyrings/debian-archive-keyring.gpg\n' > /etc/apt/sources.list.d/debian.sources
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.34.1 --activate
WORKDIR /repo

# ---------- builder ----------
FROM base AS builder
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@avastudio/worker
RUN pnpm --filter=@avastudio/worker deploy --prod --legacy /app

# ---------- runtime ----------
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
RUN printf 'Types: deb\nURIs: http://mirror.timeweb.ru/debian\nSuites: bookworm bookworm-updates\nComponents: main contrib non-free non-free-firmware\nSigned-By: /usr/share/keyrings/debian-archive-keyring.gpg\n' > /etc/apt/sources.list.d/debian.sources
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      chromium \
      fonts-liberation fonts-noto-color-emoji fonts-noto-cjk \
      ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*

ENV FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY --from=builder /app /app

RUN addgroup --system --gid 1001 avs && adduser --system --uid 1001 --ingroup avs avs \
    && chown -R avs:avs /app
USER avs

EXPOSE 4001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--import", "tsx/esm", "src/index.ts"]
