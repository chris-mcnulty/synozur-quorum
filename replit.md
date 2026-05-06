# Quorum

Quorum is a multi-tenant application that facilitates AI-powered board deliberations, cross-examinations, and strategic insights for organizations.

## Run & Operate

- `pnpm run typecheck` — Full typecheck across all packages.
- `pnpm run build` — Typecheck and build all packages.
- `pnpm --filter @workspace/api-spec run codegen` — Regenerate API hooks and Zod schemas from OpenAPI spec.
- `pnpm --filter @workspace/db run push` — Push DB schema changes (development only).
- `pnpm --filter @workspace/api-server run dev` — Run API server locally.

## Stack

- **Frameworks**: Express 5 (API), React (Frontend)
- **Runtime**: Node.js 24
- **ORM**: Drizzle ORM
- **Validation**: Zod, `drizzle-zod`
- **Build Tool**: esbuild (CJS bundle)
- **Monorepo**: pnpm workspaces
- **TypeScript**: 5.9

## Where things live

- `artifacts/api-server/` — Backend API server.
  - `src/lib/crossExaminationRunner.ts` — Cross-examination backend logic.
  - `src/routes/crossExaminations.ts` — Cross-examination API routes.
  - `src/routes/roster.ts` — Tenant Advisor Roster API routes.
  - `src/routes/grounding.ts` — Grounding Documents API routes.
  - `src/routes/ai.ts` — AI Provider Management API routes.
  - `src/app.ts` — API server entry point, serves static boardroom assets.
- `artifacts/boardroom/` — Frontend application.
  - `src/pages/CrossExamLauncher.tsx`, `CrossExamDetail.tsx` — Cross-examination UI.
  - `src/themes/aurora.css`, `src/themes/baseline.css` — Core theme files.
  - `src/contexts/ThemeContext.tsx` — Theme management context.
  - `src/components/ThemeToggle.tsx` — Theme switching UI.
  - `src/pages/Roster.tsx` — Tenant Advisor Roster UI.
  - `src/pages/GroundingDocs.tsx` — Grounding Documents UI.
  - `src/pages/AiModels.tsx` — AI Provider Management UI.
- `lib/db/src/schema/` — Database schemas.
  - `roster.ts` — Tenant Advisor Roster schema.
  - `grounding.ts` — Grounding Documents schema.
  - `ai.ts` — AI Provider Management schema.
- `lib/api-spec/openapi.yaml` — OpenAPI specification (source-of-truth for API contracts).

## Architecture decisions

- **Monorepo Structure**: Uses pnpm workspaces for managing multiple packages (API server, frontend, shared libraries) within a single repository to streamline development and dependency management.
- **AI-Driven Deliberation**: Core functionality relies heavily on Claude models (Haiku, Sonnet, Opus) for advisor deliberations, chair synthesis, and cross-examination synthesis.
- **Tenant-Scoped Data**: Critical features like Advisor Roster, Grounding Documents, and AI Provider Management are tenant-scoped, ensuring data isolation and customizable experiences per tenant.
- **Static Frontend Serving**: The frontend (Boardroom) is built as static assets and served directly by the API server, simplifying deployment and infrastructure.
- **OpenAPI Codegen**: Utilizes Orval for generating API client hooks and Zod schemas from an OpenAPI specification, ensuring strong type-safety and consistency between frontend and backend.

## Product

- **Boards & Advisors**: Tenants can create multiple boards with up to 5 AI advisor members for deliberation.
- **Sessions**: Facilitates structured deliberation sessions where a question is posed, advisors discuss, and a chair synthesizes insights.
- **Cross-Examinations**: Enables parallel deliberation across 2-4 boards on a single question, providing alignment matrices, unique insights, and meta-recommendations.
- **Tenant Advisor Roster**: A tenant-specific library of reusable AI advisors with customizable instructions and grounding documents.
- **Grounding Documents**: Allows tenants to upload and manage documents to provide context for AI models, improving the relevance and accuracy of AI responses.
- **AI Provider Management**: Provides tenant-scoped configuration for AI models, including provider selection, cost tracking, and usage monitoring.
- **Constellation SCDP Design System**: Implements a consistent UI/UX across the application with theming (Aurora, Baseline), dark mode, and reusable components.

## User preferences

_Populate as you build_

## Gotchas

- Frontend changes in `artifacts/boardroom` require running `pnpm --filter @workspace/boardroom run build` in development mode as the `web` workflow is a noop.
- Do not call `setBaseUrl("/api")` in `main.tsx` in the frontend; the generated API client URLs already include the `/api` prefix due to the OpenAPI spec.
- Global/preset grounding documents (`tenantId = NULL`) are readable by any authenticated caller but cannot be deleted via the API.
- For preset-seated board members, their grounding document is locked and cannot be changed without removing and re-seating the member.
- Ensure to run `pnpm --filter @workspace/scripts run seed-preset-grounding` to seed placeholder global grounding documents for preset personas; replace placeholder text with canonical source material before production.

## Pointers

- **pnpm-workspace skill**: For detailed information on workspace structure, TypeScript setup, and package specifics.
- **Synozur Orbit**: Reference for the Grounding Documents subsystem.
- **Synozur SCDP (Constellation)**: Reference for the AI Provider Management system and design system concepts.
  - [Synozur Orbit GitHub](https://github.com/chris-mcnulty/synozur-orbit)
  - [Synozur SCDP GitHub](https://github.com/chris-mcnulty/synozur-scdp)