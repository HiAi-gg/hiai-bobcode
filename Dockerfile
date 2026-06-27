FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# --- Install dependencies ---
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/*/package.json packages/
COPY packages/sdk/js/package.json ./packages/sdk/js/
COPY patches ./patches/
# Strip workspaces that don't exist in the Docker build context
RUN bun -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.workspaces.packages=p.workspaces.packages.filter(w=>w!=='packages/slack'&&!w.startsWith('packages/console/'));fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
RUN bun install

# --- Build ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN cd packages/opencode && bun run build

# --- Runtime ---
FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/opencode/dist ./packages/opencode/dist
COPY packages/opencode/package.json ./packages/opencode/

ENV NODE_ENV=production

RUN addgroup -S bob && adduser -S bob -G bob \
    && chown -R -h bob:bob /app

USER bob

HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:50900/health || exit 1

EXPOSE 50900 50901

CMD ["bun", "--cwd", "packages/opencode", "dist/index.js", "serve", "--port", "50900", "--hostname", "0.0.0.0"]