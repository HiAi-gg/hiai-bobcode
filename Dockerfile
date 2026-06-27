FROM oven/bun:1.3-alpine AS base
WORKDIR /app

# --- Install dependencies ---
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/app/package.json ./packages/app/
COPY packages/opencode/package.json ./packages/opencode/
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/js/package.json ./packages/sdk/js/
# Strip workspaces that don't exist in the Docker build context
RUN bun -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.workspaces.packages=p.workspaces.packages.filter(w=>w==='packages/*'||w==='packages/sdk/js');fs.writeFileSync('package.json',JSON.stringify(p,null,2))"
RUN bun install

# --- Runtime ---
FROM base AS runtime
COPY --from=deps /app/node_modules ./node_modules
COPY packages/opencode/dist ./packages/opencode/dist
COPY packages/opencode/package.json ./packages/opencode/

ENV NODE_ENV=production

RUN addgroup -S bob && adduser -S bob -G bob \
    && chown -R -h bob:bob /app

USER bob

HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:50900/health || exit 1

EXPOSE 50900 50901

CMD ["bun", "--cwd", "packages/opencode", "dist/index.js", "serve", "--port", "50900", "--hostname", "0.0.0.0"]