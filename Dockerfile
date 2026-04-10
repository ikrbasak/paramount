FROM oven/bun:1.3.12-alpine AS base
WORKDIR /app

FROM base AS builder

COPY package.json bun.lock bunfig.toml /app
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM base AS release

ENV SERVER_PORT=8080
ENV TZ=UTC
ENV NODE_ENV=production
ENV DO_NOT_TRACK=true
ENV MIKRO_ORM_TIMEZONE=UTC

COPY --from=builder /app/build build

USER bun
EXPOSE 8080/tcp

HEALTHCHECK --interval=5s --timeout=5s --start-period=5s --retries=5 \
  CMD wget --quiet --tries=5 --timeout=5 --spider \
  "http://localhost:${SERVER_PORT}/api/v1/health" || exit 1

ENTRYPOINT ["bun"]
CMD ["build/index.js"]
