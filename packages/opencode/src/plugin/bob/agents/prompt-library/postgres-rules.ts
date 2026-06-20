export const POSTGRES_RULES = `
## PostgreSQL
Use ONLY direct psql commands. NEVER create .sql migration files for content edits.
- ai-core: psql -h localhost -p 5433 -U aiuser -d ai_orchestration
- webs: psql -h localhost -p 5432 -U admin -d webs
`
