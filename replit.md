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

## Boardroom serving

The boardroom is built statically and served by the api-server (see `artifacts/api-server/src/app.ts` static fallback). Its workflow `artifacts/boardroom: web` is a noop in dev mode — that is normal and not a bug. To pick up frontend changes during dev, run `pnpm --filter @workspace/boardroom run build`.

The api client (`@workspace/api-client-react`) generates URLs that already include the `/api` prefix because `lib/api-spec/openapi.yaml` declares `servers: [{url: /api}]`. Do **not** call `setBaseUrl("/api")` in main.tsx — that would double-prefix every request to `/api/api/...`.
