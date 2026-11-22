# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the upwin community API.
#
#   base       corepack + pinned pnpm, shared by every other stage
#   deps       full dependency tree (dev included) — needed to build and to migrate
#   build      compiles src/ to dist/ with the Nest CLI (tsc, per nest-cli.json)
#   prod-deps  runtime dependency tree only
#   runner     the final image: prod deps + dist + the generated SQL, nothing else
#
# There is deliberately only ONE runtime image. Migrations run from it with
# `node dist/database/migrate.js`, which uses drizzle-orm's migrator against the
# SQL in drizzle/ — so drizzle-kit and the dev tree never ship to production,
# and one image tag is one atomic deploy.
#
# Debian slim rather than Alpine: @swc/core (pulled in by vitest through
# unplugin-swc) ships glibc binaries, and a musl mismatch there fails at install
# time with a message that points nowhere useful.

ARG NODE_VERSION=24.14.1
ARG PNPM_VERSION=11.22.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# pnpm-workspace.yaml carries the allowBuilds decisions. pnpm 11 refuses to run
# postinstall scripts without them, so it must be copied alongside the manifest.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --store-dir /pnpm/store

FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
# Inside a container the API must listen on every interface to be reachable
# through the published port. Publish that port on 127.0.0.1 only, or set
# API_TOKEN; the env schema refuses 0.0.0.0 otherwise.
ENV HOST=0.0.0.0
# ffmpeg/ffprobe remux recordings and cut poster frames (video proposals).
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /tmp/upwin-videos && chown node:node /tmp/upwin-videos
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# The generated migration SQL and its journal. dist/database/migrate.js resolves
# this from process.cwd(), which is /app.
COPY drizzle ./drizzle
# Only read when AI_MODE is replay or fake. model-registry.ts resolves this
# directory from process.cwd(), which is /app here.
COPY src/ai/__cassettes__ ./src/ai/__cassettes__
USER node
EXPOSE 3002
CMD ["node", "dist/main.js"]
