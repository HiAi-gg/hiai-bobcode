# Quickstart

Get hiai-bobcode running in 5 minutes.

## Prerequisites
- **Bun** 1.3.14+ (`curl -fsSL https://bun.sh/install | bash`)
- **Git**

## Install

```bash
git clone https://github.com/HiAi-gg/hiai-bobcode.git
cd hiai-bobcode
bun install
```

## Run

```bash
# Backend (API server on :50900)
bun dev

# In another terminal — Web UI (on :50901)
bun dev:web
```

Open http://localhost:50901 in your browser.

## Optional: API Keys

Copy `bob.env.example` to `bob.env` and add:
- `FIRECRAWL_API_KEY` — from [firecrawl.dev](https://firecrawl.dev)
- `CONTEXT7_API_KEY` — from [context7.com](https://context7.com) (optional, works without for low usage)

## Verify

```bash
curl -fsS http://localhost:50900/health
```

## Next Steps
- [README.md](../README.md) — full project overview
- [docs/development.md](development.md) — detailed dev setup
- [ARCHITECTURE.md](../ARCHITECTURE.md) — system architecture