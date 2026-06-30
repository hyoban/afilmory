# Dockerfile for Next.js app in a pnpm monorepo
# This Dockerfile should be built from the root of the monorepo:
# > docker build -t photo-gallery-ssr -f apps/ssr/dockerfile .

# -----------------
# Base stage
# -----------------
FROM node:lts-alpine AS base
WORKDIR /app
RUN corepack enable

# -----------------
# Builder stage
# -----------------
FROM base AS builder

RUN apk update && apk add --no-cache git perl
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch --frozen-lockfile

COPY . .
RUN sh ./scripts/preinstall.sh
# Install all dependencies from the lockfile-backed store fetched above.
RUN pnpm install --frozen-lockfile --offline

# Copy zeroperl.wasm to web public directory before build.
# @uswriting/exiftool depends on @6over3/zeroperl-ts which loads zeroperl.wasm via fetch("./zeroperl.wasm")
# relative to the current page URL, so it must be available under both root and /photos/ paths.
RUN mkdir -p apps/web/public/photos && \
    find node_modules -name "zeroperl.wasm" -path "*/esm/*" -exec cp {} apps/web/public/ \; -exec cp {} apps/web/public/photos/ \; -quit

# Build-time fallback only. Real local-photo data is generated into the runtime
# manifest volume by docker-entrypoint.sh before the server starts.
RUN mkdir -p apps/web/src/data && \
    printf '%s\n' '{"version":"0.0.0","data":[],"cameras":[],"lenses":[]}' > apps/web/src/data/photos-manifest.json

ARG S3_ACCESS_KEY_ID
ARG S3_SECRET_ACCESS_KEY
ARG GIT_TOKEN
ARG PG_CONNECTION_STRING
# Build the app.
# The build script in the ssr package.json handles building the web app first.
# Docker local-photo mode mounts photos, thumbnails, and the runtime manifest at container runtime,
# so image builds use the empty fallback manifest instead of scanning a host-local photo directory.
RUN AFILMORY_SKIP_BUILD_MANIFEST=1 pnpm --filter=@afilmory/ssr build

# -----------------
# Runner stage
# -----------------
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
# ENV PORT and other configurations are now in the config files
# and passed through environment variables during runtime.
RUN apk add --no-cache curl wget perl
# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /data/photos /data/manifest /workspace && chown -R nextjs:nodejs /data /workspace

COPY --from=builder --chown=nextjs:nodejs /app/apps/ssr/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/ssr/.next/static /app/apps/ssr/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/ssr/public /app/apps/ssr/public
COPY --from=builder --chown=nextjs:nodejs /app/package.json /workspace/package.json
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-lock.yaml /workspace/pnpm-lock.yaml
COPY --from=builder --chown=nextjs:nodejs /app/pnpm-workspace.yaml /workspace/pnpm-workspace.yaml
COPY --from=builder --chown=nextjs:nodejs /app/site.config.ts /workspace/site.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/config.json /workspace/config.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules /workspace/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/packages /workspace/packages
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-builder.config.ts /workspace/builder.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN mkdir -p \
    /workspace/apps/web/src/data \
    /workspace/apps/web/public/thumbnails \
  && chown -R nextjs:nodejs /workspace/apps/web \
  && chmod +x /app/docker-entrypoint.sh

USER nextjs

# The standalone output includes the server.js file.
# The PORT environment variable is automatically used by Next.js.
EXPOSE 3000

CMD ["/app/docker-entrypoint.sh"]
