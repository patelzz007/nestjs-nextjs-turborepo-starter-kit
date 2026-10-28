# syntax=docker/dockerfile:1.7
# ============================================================================
# One Dockerfile for every deployable of the monorepo (ADR 068, phase 4). Pick one with --target:
#
#   docker build -f deploy/docker/Dockerfile --target api          -t starter/api .
#   docker build -f deploy/docker/Dockerfile --target web          -t starter/web .
#   docker build -f deploy/docker/Dockerfile --target admin        -t starter/admin .
#   docker build -f deploy/docker/Dockerfile --target merchant     -t starter/merchant .
#   docker build -f deploy/docker/Dockerfile --target load-runner  -t starter/load-runner .
#   docker build -f deploy/docker/Dockerfile --target server-agent -t starter/server-agent .
#
# The workspace is installed once from the lockfile and each target builds only what its app needs
# (turbo's `--filter=<app>...`). The API image carries `pg_dump` 18 (database backups) from the
# PostgreSQL project's own apt repository; the load runner carries k6.
# ============================================================================

ARG NODE_VERSION=24.22.1

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# ── The workspace, installed once ────────────────────────────────────────────
FROM base AS workspace
COPY . .
RUN pnpm install --frozen-lockfile

FROM workspace AS build-api
RUN pnpm turbo run build --filter=@workspace/api...

FROM workspace AS build-web
RUN pnpm turbo run build --filter=@workspace/web...

FROM workspace AS build-admin
RUN pnpm turbo run build --filter=@workspace/admin...

FROM workspace AS build-merchant
RUN pnpm turbo run build --filter=@workspace/merchant...

# The two Node processes run their TypeScript with tsx, but the workspace packages they import
# (@workspace/shared, @workspace/messaging) resolve to their built output outside development.
FROM workspace AS build-load-runner
RUN pnpm turbo run build --filter=@workspace/load-runner^...

FROM workspace AS build-server-agent
RUN pnpm turbo run build --filter=@workspace/server-agent^...

# ── API (+ pg_dump 18 for backups) ───────────────────────────────────────────
FROM base AS api
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates curl gnupg \
	&& install -d /usr/share/postgresql-common/pgdg \
	&& curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
	&& echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends postgresql-client-18 \
	&& apt-get purge -y gnupg \
	&& rm -rf /var/lib/apt/lists/*
COPY --from=build-api /repo /repo
WORKDIR /repo/apps/api
ENV NODE_ENV=production
EXPOSE 8080
USER node
CMD ["node", "dist/main.js"]

# ── The three Next.js apps ───────────────────────────────────────────────────
FROM base AS web
COPY --from=build-web /repo /repo
ENV NODE_ENV=production
EXPOSE 3000
USER node
CMD ["pnpm", "--filter", "@workspace/web", "start"]

FROM base AS admin
COPY --from=build-admin /repo /repo
ENV NODE_ENV=production
EXPOSE 3001
USER node
CMD ["pnpm", "--filter", "@workspace/admin", "exec", "next", "start", "--port", "3001"]

FROM base AS merchant
COPY --from=build-merchant /repo /repo
ENV NODE_ENV=production
EXPOSE 3003
USER node
CMD ["pnpm", "--filter", "@workspace/merchant", "start"]

# ── Load runner (+ k6) ───────────────────────────────────────────────────────
FROM grafana/k6:1.0.0 AS k6

# tsx is started directly, not through `pnpm start`: pnpm re-verifies the install before every script,
# which the unprivileged user cannot (and need not) do in a built image.
FROM base AS load-runner
COPY --from=build-load-runner /repo /repo
COPY --from=k6 /usr/bin/k6 /usr/bin/k6
WORKDIR /repo/apps/load-runner
ENV NODE_ENV=production
USER node
CMD ["node_modules/.bin/tsx", "src/main.ts"]

# ── Server agent ─────────────────────────────────────────────────────────────
FROM base AS server-agent
COPY --from=build-server-agent /repo /repo
WORKDIR /repo/apps/server-agent
ENV NODE_ENV=production
CMD ["node_modules/.bin/tsx", "src/main.ts"]
