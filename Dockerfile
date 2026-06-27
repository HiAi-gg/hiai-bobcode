# Use the official Bun image
FROM oven/bun:1.3-alpine

WORKDIR /app

RUN addgroup -S bob && adduser -S bob -G bob

# Copy configuration and lockfiles
COPY package.json bun.lock ./
COPY packages/app/package.json ./packages/app/
COPY packages/opencode/package.json ./packages/opencode/
COPY packages/shared/package.json ./packages/shared/
COPY packages/sdk/js/package.json ./packages/sdk/js/

# Install dependencies (utilizes Docker layer caching)
RUN bun install

# Copy the rest of the application
COPY . .

USER bob

# Expose default ports (50900 for backend api, 50901 for frontend UI)
EXPOSE 50900 50901
CMD ["bun", "--cwd", "packages/opencode", "src/index.ts", "serve", "--port", "50900", "--hostname", "0.0.0.0"]
