# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Quorum (boardroom artifact) features

- **Boards & advisors**: tenants own multiple boards, each with up to ~5 advisor members.
- **Sessions**: a question is put to one board; chair frames it, advisors deliberate (Claude Haiku), chair synthesizes (Claude Sonnet), optional voting in BOARD mode.
- **Cross-examinations** (new): one question put to 2-4 boards in parallel, then a Master synthesizer (Claude Opus 4.7) produces an alignment matrix, per-board unique insights, and a meta-recommendation. Persisted as first-class objects with their own URL `/cross-examinations/:id` and surfaced on the tenant dashboard.
  - Backend: `artifacts/api-server/src/lib/crossExaminationRunner.ts`, `routes/crossExaminations.ts`. SSE stream at `/api/cross-examinations/:id/stream` forwards each child session's events plus a synthesis phase.
  - Frontend: `artifacts/boardroom/src/pages/CrossExamLauncher.tsx` and `CrossExamDetail.tsx`. Detail page renders side-by-side board columns with live event log during run, and matrix/insights/meta-recommendation when synthesis completes.
  - DB: `cross_examinations` table; `advisory_sessions.cross_examination_id` FK links child sessions.

## Boardroom serving

The boardroom is built statically and served by the api-server (see `artifacts/api-server/src/app.ts` static fallback). Its workflow `artifacts/boardroom: web` is a noop in dev mode — that is normal and not a bug. To pick up frontend changes during dev, run `pnpm --filter @workspace/boardroom run build`.

The api client (`@workspace/api-client-react`) generates URLs that already include the `/api` prefix because `lib/api-spec/openapi.yaml` declares `servers: [{url: /api}]`. Do **not** call `setBaseUrl("/api")` in main.tsx — that would double-prefix every request to `/api/api/...`.
