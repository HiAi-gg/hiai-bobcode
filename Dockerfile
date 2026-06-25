# Use the official Bun image
FROM oven/bun:latest

WORKDIR /app

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

# Expose default ports (50900 for backend api, 50902 for frontend UI)
EXPOSE 50900 50902
