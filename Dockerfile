FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# --- Install dependencies ---
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/opencode/package.json packages/opencode/
COPY packages/plugin/package.json    packages/plugin/
COPY packages/script/package.json    packages/script/
COPY packages/sdk/js/package.json    packages/sdk/js/
COPY packages/ui/package.json        packages/ui/
COPY packages/shared/package.json    packages/shared/
COPY patches ./patches/
RUN bun -e "const{readFileSync,writeFileSync}=require('fs');const p=JSON.parse(readFileSync('package.json','utf8'));p.workspaces.packages=['packages/opencode','packages/plugin','packages/script','packages/ui','packages/shared','packages/sdk/js'];writeFileSync('package.json',JSON.stringify(p,null,2))"
ENV BUN_INSTALL_CONCURRENCY=1
RUN apk add --no-cache python3 make g++
RUN bun add -g node-gyp
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --ignore-scripts

# --- Build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY packages/opencode/ packages/opencode/
COPY packages/plugin/   packages/plugin/
COPY packages/script/   packages/script/
COPY packages/sdk/js/   packages/sdk/js/
COPY packages/ui/       packages/ui/
COPY packages/shared/   packages/shared/
COPY package.json bun.lock ./
COPY patches ./patches/
ENV OPENCODE_CHANNEL=latest
ENV NODE_ENV=production
ENV MODELS_DEV_API_JSON=/app/packages/opencode/models-cache.json
RUN sed -i '/preload = /d' packages/opencode/bunfig.toml
RUN cd packages/opencode && bun run script/build.ts --single --skip-embed-web-ui --skip-install

# --- Runtime ---
FROM base AS runtime
COPY --from=build /app/packages/opencode/dist/ ./dist/
RUN find /app/dist -name bob -type f -exec ln -sf {} /app/bob \; && chmod +x /app/bob
ENV NODE_ENV=production
RUN addgroup -S bob && adduser -S bob -G bob && chown -R -h bob:bob /app
USER bob
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://localhost:50900/health || exit 1
EXPOSE 50900 50901
CMD ["/app/bob", "serve", "--port", "50900", "--hostname", "0.0.0.0"]