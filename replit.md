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

## Constellation SCDP design system (Aurora UX + Baseline)

Fully implemented in `artifacts/boardroom/src/`:

- **Theme CSS files**: `src/themes/aurora.css` and `src/themes/baseline.css`. Each file defines `:root` / `.dark` and scoped `[data-theme="aurora"]` / `[data-theme="baseline"]` blocks. All CSS vars are bare HSL triplets to compose with Tailwind's `hsl(var(--...))` pattern.
- **ThemeProvider**: `src/contexts/ThemeContext.tsx` — manages `theme` (aurora|baseline) + `mode` (light|dark). Persists to localStorage. Applies `data-theme` attribute and `.dark` class to `<html>`. Wrap app in `<ThemeProvider>`.
- **ThemeToggle**: `src/components/ThemeToggle.tsx` — sun/moon button + Aurora/Baseline pill selector. Rendered in the AppShell topbar.
- **Aurora component**: `src/components/Aurora.tsx` — animated gradient blobs (`aurora-drift` keyframes) with canvas star particles in dark mode. Props: `intensity` (low/medium/high), `className`.
- **index.css additions**: `.synozur-gradient`, `.synozur-gradient-text`, `.sidebar-item-active-gradient` (3 px purple→magenta left bar on active nav), `.page-header-gradient-bar` (2 px gradient top border), `.nebula-card`, `aurora-blob` keyframes, `.animate-fade-in-up` + `.stagger-1..6`.
- **AppShell**: Migrated from hardcoded `--boa-*` inline styles to semantic CSS var classes (`bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border`, etc.). Active nav items use `sidebar-item-active-gradient`. Avatar uses `synozur-gradient`. Topbar uses `page-header-gradient-bar`. ThemeToggle rendered in header.
- **Dark mode**: Was all `red` placeholders; now properly populated from Aurora dark vars.
- **Aurora is default**: Applied to `:root` so the theme is active before JS runs.

## Tenant Advisor Roster

A tenant-scoped library of named, reusable advisors. Each advisor carries their own instructions and an optional grounding document, so seating them on any board is one click.

- **DB schema**: `lib/db/src/schema/roster.ts` — `tenantAdvisorsTable` (id, tenantId, name, roleTitle, lensDescription, instructionsText, groundingDocumentId FK → grounding_documents, createdAt).
- **API routes**: `artifacts/api-server/src/routes/roster.ts`
  - `GET /api/tenant-advisors?tenantId=` — list roster for a tenant (VIEWER)
  - `POST /api/tenant-advisors` — add named advisor (EDITOR)
  - `PATCH /api/tenant-advisors/:advisorId` — edit advisor or link a grounding doc (EDITOR)
  - `DELETE /api/tenant-advisors/:advisorId` — remove from roster (EDITOR)
  - `POST /api/boards/:boardId/seat-roster-advisor` — copies advisor + document reference to a board seat (EDITOR)
- **Frontend page**: `artifacts/boardroom/src/pages/Roster.tsx` — full CRUD UI with per-advisor document upload flow (presigned URL → register → PATCH advisor). Route: `/t/:tenantId/roster`.
- **AdvisorLibrary integration**: `AdvisorLibrary.tsx` gained a "My Roster" tab alongside "Curated Library". The roster tab lists tenant advisors with search, detail panel, and a "Seat on this board" button that calls `seat-roster-advisor`.
- **Nav item**: "Advisor Roster" (Users icon) added to AppShell sidebar. Inferred active on `/roster` paths.
- **OpenAPI + codegen**: `useListRosterAdvisors`, `useCreateRosterAdvisor`, `useUpdateRosterAdvisor`, `useDeleteRosterAdvisor`, `useSeatRosterAdvisor` generated in `@workspace/api-client-react`.

## Grounding Documents (AI Context) subsystem

Imported from [Synozur Orbit](https://github.com/chris-mcnulty/synozur-orbit) and adapted for Quorum's tenant model.

- **DB schema**: `lib/db/src/schema/grounding.ts` — `groundingDocumentsTable` (id, tenantId, filename, contentType, storagePath, extractedText, characterCount, truncated, uploadedBy, uploadedAt).
- **Text extraction**: `artifacts/api-server/src/lib/textExtract.ts` — handles PDF (pdf-parse), DOCX (mammoth), TXT/MD (UTF-8). Caps output at 50k characters.
- **API routes**: `artifacts/api-server/src/routes/grounding.ts`
  - `GET /api/grounding-documents?tenantId=...` — list docs for a tenant (VIEWER)
  - `POST /api/grounding-documents` — register doc after presigned upload + extract text (EDITOR)
  - `GET /api/grounding-documents/:documentId` — get single doc (VIEWER)
  - `DELETE /api/grounding-documents/:documentId` — remove doc record (EDITOR)
- **Storage**: File upload uses the presigned URL flow: client calls `POST /api/storage/uploads/request-url` → PUTs directly to object storage → calls `POST /api/grounding-documents` to register and extract text.
- **Frontend page**: `artifacts/boardroom/src/pages/GroundingDocs.tsx` — upload dialog (file picker → presigned upload → register), list view with file type, char count, date, processed badge, delete button.
- **Nav item**: "Context Docs" (FileStack icon) added to AppShell sidebar nav under Workspace section. Route: `/t/:tenantId/context`.
- **OpenAPI + codegen**: `listGroundingDocuments`, `registerGroundingDocument`, `deleteGroundingDocument`, `requestUploadUrl` hooks generated in `@workspace/api-client-react`.

## AI Provider Management

Tenant-scoped system for specifying and monitoring the language models used by each Quorum AI feature. Modeled after the AI settings system in [synozur-scdp](https://github.com/chris-mcnulty/synozur-scdp) (Constellation SCDP).

- **DB schema**: `lib/db/src/schema/ai.ts` — two tables:
  - `tenant_ai_model_configs` — one row per (tenantId × feature). Stores provider, modelId, per-token cost rates (μ$/M tokens), maxTokens, enabled flag. Unique constraint on (tenantId, feature). Auto-seeded with defaults on first GET.
  - `ai_usage_logs` — one row per LLM call. Stores provider, modelId, feature, promptTokens, completionTokens, estimatedCostMicrodollars, latencyMs, success/errorCode, sessionId FK.
- **Constants in schema**: `AI_FEATURES`, `AI_PROVIDERS`, `AI_MODEL_CATALOG` (8 models with best-estimate costs), `AI_FEATURE_DEFAULTS` (maps each feature to its default model).
- **API routes**: `artifacts/api-server/src/routes/ai.ts`
  - `GET /api/tenants/:tenantId/ai/catalog` — model catalog + feature list (VIEWER)
  - `GET /api/tenants/:tenantId/ai/model-configs` — list configs, seeding defaults if needed (VIEWER)
  - `PUT /api/tenants/:tenantId/ai/model-configs/:feature` — upsert config (EDITOR)
  - `GET /api/tenants/:tenantId/ai/usage` — 30-day aggregated usage stats (VIEWER)
  - `GET /api/tenants/:tenantId/ai/usage/logs` — recent log entries (VIEWER)
- **Frontend page**: `artifacts/boardroom/src/pages/AiModels.tsx` — three tabs:
  - *Model Configuration*: per-feature cards with provider/model picker (grouped by provider), max tokens, cost inputs (auto-populated from catalog), enable toggle.
  - *Usage Dashboard*: 4 stat tiles, usage-by-feature and usage-by-model bars, 30-day daily bar chart.
  - *Recent Calls*: table of individual LLM call logs.
- **Nav item**: "AI Models" (Brain icon) added to AppShell Administration section. Route: `/t/:tenantId/ai-models`.
- **Default model assignments** (Quorum built-in models, May 2026 pricing):
  | Feature | Model | Input | Output |
  |---|---|---|---|
  | Advisor Deliberation | claude-haiku-4-5 | $0.80/M | $4.00/M |
  | Chair Synthesis | claude-sonnet-4-5 | $3.00/M | $15.00/M |
  | Cross-Exam Synthesis | claude-opus-4-7 | $15.00/M | $75.00/M |
- **Usage logging**: The routes expose the write endpoint; call-sites in `sessionRunner.ts` / `crossExaminationRunner.ts` should insert rows into `ai_usage_logs` after each Anthropic call to enable monitoring (future work to wire up). The infrastructure is ready.

## Synozur SCDP (Constellation) — Reference Repo

URL: https://github.com/chris-mcnulty/synozur-scdp

Constellation is the **Synozur Consulting Delivery Platform (SCDP)** — a multi-tenant SaaS PSA/PM tool covering estimation, resource allocation, time tracking, expense management, and invoice generation. Quorum's AI management feature was modeled after its `client/src/pages/ai-settings.tsx`.

### Constellation design system

- **App name**: Constellation (also called SCDP internally)
- **Font**: `Avenir Next LT Pro` exclusively — loaded from `client/public/fonts/` via `@font-face` in `client/src/index.css`. Never Inter or system-ui.
- **Theme engine**: Three theme files in `client/src/themes/`:
  - `aurora.css` — purple primary `hsl(268.98 96.72% 52.16%)`, pink secondary `hsl(314.04 90.08% 47.45%)`, large border-radius 1.3rem
  - `night-sky.css`, `navigators-chart.css` — alternate themes
- **Colors**: Standard shadcn/ui CSS vars (`--primary`, `--secondary`, `--background`, `--foreground`, `--muted`, `--accent`, etc.) as bare HSL triplets for Tailwind composition
- **Utility classes**: `.synozur-gradient` (135° purple→pink), `.synozur-gradient-text`, `.cosmic-text` (HSL gradient clip), `.glow-primary` (box-shadow glow)
- **Layout**: `Layout` component wraps `Header` + `Sidebar` (left-side nav). Sidebar uses shadcn sidebar vars (`--sidebar`, `--sidebar-foreground`, `--sidebar-border`, etc.)
- **UI library**: Radix UI / shadcn/ui components + Tailwind CSS
- **Routing**: `wouter` (`Switch`/`Route`)
- **Data fetching**: TanStack Query v5

### Constellation navigation structure

Admin section routes (accessible to platform admins): `/ai-settings`, `/platform-tenants`, `/platform-users`, `/platform-service-plans`, `/platform-grounding-docs`, `/scheduled-jobs`, `/background-jobs`, `/admin/galaxy`, `/admin/planner-sync-health`, `/admin/signoffs`

AI Settings page (`/ai-settings`) has three sections:
1. **Model Config** — provider selector (Replit AI, Azure AI Foundry), model selector, streaming toggle, max tokens, monthly token budget, alert thresholds (percentage-based budget alerts)
2. **Usage Dashboard** — 4 KPI tiles, usage by feature bars, usage by model bars, 30-day daily bar chart, recent AI calls table
3. **Alert History** — table of triggered budget threshold alerts

Backend stores AI config in a single `ai_configuration` table (singleton per platform) and logs calls to `ai_usage_logs` + `ai_usage_summaries`.

## Boardroom serving

The boardroom is built statically and served by the api-server (see `artifacts/api-server/src/app.ts` static fallback). Its workflow `artifacts/boardroom: web` is a noop in dev mode — that is normal and not a bug. To pick up frontend changes during dev, run `pnpm --filter @workspace/boardroom run build`.

The api client (`@workspace/api-client-react`) generates URLs that already include the `/api` prefix because `lib/api-spec/openapi.yaml` declares `servers: [{url: /api}]`. Do **not** call `setBaseUrl("/api")` in main.tsx — that would double-prefix every request to `/api/api/...`.
