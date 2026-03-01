# AGENTS.md

## Cursor Cloud specific instructions

### Overview

WingFox is a pnpm monorepo (Turborepo) with two apps:

- **`apps/web`** — React 19 SPA (Vite, port 3000). Proxies `/api` to port 3001.
- **`apps/api`** — Hono REST API (tsx, port 3001). Reads `.env` for Supabase / Mistral keys.

Standard commands (`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`) are defined in root `package.json` and run via `mise exec -- turbo <task>`.

### Tooling

- **mise** manages Node 22 + pnpm 10.13.1 (see `.mise.toml`). All root scripts use `mise exec --`.
- **Biome** handles lint/format for `apps/web`. The API has no linter configured.
- **vitest** is configured in `apps/web` but no test files exist yet.

### Local Supabase

Local development uses `npx supabase start` (requires Docker). This starts Postgres, Auth, Realtime, Studio, etc. on ports 54321–54324.

- After starting Supabase, use the output keys to populate `apps/web/.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and `apps/api/.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- See `.env.example` in each app for the expected variable names.

### Starting dev servers

1. Start local Supabase: `npx supabase start`
2. API: `cd apps/api && mise exec -- pnpm dev` (port 3001)
3. Web: `cd apps/web && mise exec -- pnpm dev` (port 3000)
4. Or use `pnpm dev` from root to start both via Turborepo (interactive TUI).

### Test users

Use `scripts/create-user-with-fox.sh` to create onboarding-complete test users. Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as env vars. See `scripts/README.md` for full usage. Test account list is in `scripts/TEST_ACCOUNTS.md`.

### Running AI features

`MISTRAL_API_KEY` must be set in `apps/api/.env` for AI-powered features to work (persona generation, speed dating conversation, matching scoring, fox search). Without it, endpoints return 500 "Mistral API not configured". Add it to `.env` alongside the Supabase keys.

To create a match between two test users and generate AI conversation scores:
```bash
POST /api/internal/matching/execute   # creates match records
POST /api/internal/fox-conversations/execute   # runs Mistral AI fox conversations (slow, ~30-60s)
```

### Gotchas

- `pnpm install` blocks on build scripts for `@biomejs/biome`, `@tailwindcss/oxide`, `esbuild`, `sharp`, `workerd`. The root `package.json` includes `pnpm.onlyBuiltDependencies` to allowlist these.
- The "Explore Foxes" feature and all AI matching require `MISTRAL_API_KEY`; without it these fail with 500.
- Docker is needed for `npx supabase start`. In the Cloud Agent environment, Docker requires `fuse-overlayfs` and `iptables-legacy` configuration.
- The `/api/internal/*` endpoints have no authentication — they are meant to be called by cron/worker, not exposed publicly.
- There are two registration routes (`/register` works with Supabase, `/signup` is a broken mock) — use `/register`.
- `onboarding_status` in `user_profiles` controls routing. Users created via `create-user-with-fox.sh` have status `"confirmed"` and skip onboarding. If fox-search/speed-dating is triggered on such a user, the status may revert — fix it via direct DB update if needed.
