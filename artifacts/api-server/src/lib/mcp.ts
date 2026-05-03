import crypto from "node:crypto";
import { type Request } from "express";
import {
  db,
  tenantsTable,
  tenantMembersTable,
  boardsTable,
  boardMembersTable,
  advisorySessionsTable,
  sessionContributionsTable,
  sessionSummariesTable,
  decisionsTable,
  decisionOutcomesTable,
  mcpApiKeysTable,
  type TenantRole,
} from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  createMcpServer,
  extractTemplateVars,
  type McpAuthContext,
  type McpToolDef,
  type McpResourceDef,
  type McpPromptDef,
} from "@workspace/mcp-server";
import { runSession, subscribeToSession } from "./sessionRunner";
import { getTenantRole } from "./tenantAuth";

const MCP_KEY_PREFIX = "mcp_";

const ROLE_RANK: Record<TenantRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  EDITOR: 2,
  VIEWER: 1,
};

export function generateApiKey(): { plaintext: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(24).toString("base64url");
  const plaintext = `${MCP_KEY_PREFIX}${random}`;
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
  const prefix = plaintext.slice(0, 12);
  return { plaintext, hash, prefix };
}

export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

async function authenticateApiKey(
  req: Request,
): Promise<McpAuthContext | null> {
  const auth = req.header("authorization") ?? req.header("Authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (!match) return null;
  const plaintext = match[1].trim();
  if (!plaintext.startsWith(MCP_KEY_PREFIX)) return null;
  const hash = hashApiKey(plaintext);
  const [row] = await db
    .select()
    .from(mcpApiKeysTable)
    .where(
      and(eq(mcpApiKeysTable.keyHash, hash), isNull(mcpApiKeysTable.revokedAt)),
    )
    .limit(1);
  if (!row) return null;
  // Touch lastUsedAt asynchronously; failures here shouldn't block the request.
  void db
    .update(mcpApiKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(mcpApiKeysTable.id, row.id))
    .catch(() => undefined);
  return {
    tenantId: row.tenantId,
    userId: row.userId,
    scopes: row.scopes ?? [],
    source: "api_key",
    keyId: row.id,
  };
}

async function authenticateSession(
  req: Request,
): Promise<McpAuthContext | null> {
  // Browser session fallback so the in-product "Try MCP" tester works.
  if (!req.isAuthenticated?.() || !req.user?.id) return null;
  const userId = req.user.id;
  const tenantId =
    (req.header("x-quorum-tenant") as string | undefined) ??
    (req.query.tenantId as string | undefined);
  if (!tenantId) return null;
  const role = await getTenantRole(userId, tenantId);
  if (!role) return null;
  return {
    tenantId,
    userId,
    scopes: [
      "boards:read",
      "boards:write",
      "sessions:read",
      "sessions:write",
      "decisions:read",
      "decisions:write",
    ],
    source: "oauth",
  };
}

async function ensureTenantRole(
  ctx: McpAuthContext,
  tenantId: string,
  minRole: TenantRole,
) {
  if (ctx.tenantId !== tenantId) {
    throw new Error("Cross-tenant access is not allowed for this MCP session.");
  }
  const role = await getTenantRole(ctx.userId, tenantId);
  if (!role) throw new Error("Caller is not a member of the tenant.");
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new Error(`Requires tenant role ${minRole} or higher.`);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Tools
// ─────────────────────────────────────────────────────────────────────

const tools: McpToolDef[] = [
  {
    name: "list_tenants",
    description: "List the workspace (tenant) bound to this MCP session.",
    scopes: ["boards:read"],
    inputSchema: z.object({}),
    handler: async (_input, ctx) => {
      const [t] = await db
        .select()
        .from(tenantsTable)
        .where(eq(tenantsTable.id, ctx.tenantId))
        .limit(1);
      if (!t) return { tenants: [] };
      return {
        tenants: [
          {
            id: t.id,
            name: t.name,
            slug: t.slug,
            createdAt: t.createdAt.toISOString(),
          },
        ],
      };
    },
  },
  {
    name: "list_boards",
    description:
      "List boards (advisor councils) in the current workspace, with member and session counts.",
    scopes: ["boards:read"],
    inputSchema: z.object({}),
    handler: async (_input, ctx) => {
      await ensureTenantRole(ctx, ctx.tenantId, "VIEWER");
      const rows = await db
        .select()
        .from(boardsTable)
        .where(eq(boardsTable.tenantId, ctx.tenantId))
        .orderBy(desc(boardsTable.updatedAt));
      return {
        boards: rows.map((b) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          topicArea: b.topicArea,
          size: b.size,
          updatedAt: b.updatedAt.toISOString(),
        })),
      };
    },
  },
  {
    name: "get_board",
    description:
      "Fetch a board with its seated advisors, master prompt, and default models.",
    scopes: ["boards:read"],
    inputSchema: z.object({
      boardId: z.string().describe("UUID of the board to fetch."),
    }),
    handler: async ({ boardId }, ctx) => {
      const [board] = await db
        .select()
        .from(boardsTable)
        .where(eq(boardsTable.id, boardId))
        .limit(1);
      if (!board) throw new Error(`Board not found: ${boardId}`);
      await ensureTenantRole(ctx, board.tenantId, "VIEWER");
      const members = await db
        .select()
        .from(boardMembersTable)
        .where(eq(boardMembersTable.boardId, boardId))
        .orderBy(boardMembersTable.ordering);
      return {
        id: board.id,
        name: board.name,
        description: board.description,
        topicArea: board.topicArea,
        masterInstructionsText: board.masterInstructionsText,
        size: board.size,
        defaultMemberModel: board.defaultMemberModel,
        defaultMasterModel: board.defaultMasterModel,
        members: members.map((m) => ({
          id: m.id,
          name: m.name,
          roleTitle: m.roleTitle,
          lensDescription: m.lensDescription,
        })),
      };
    },
  },
  {
    name: "list_advisors",
    description: "List the seated advisors on a board.",
    scopes: ["boards:read"],
    inputSchema: z.object({ boardId: z.string() }),
    handler: async ({ boardId }, ctx) => {
      const [board] = await db
        .select()
        .from(boardsTable)
        .where(eq(boardsTable.id, boardId))
        .limit(1);
      if (!board) throw new Error(`Board not found: ${boardId}`);
      await ensureTenantRole(ctx, board.tenantId, "VIEWER");
      const members = await db
        .select()
        .from(boardMembersTable)
        .where(eq(boardMembersTable.boardId, boardId))
        .orderBy(boardMembersTable.ordering);
      return {
        advisors: members.map((m) => ({
          id: m.id,
          name: m.name,
          roleTitle: m.roleTitle,
          lensDescription: m.lensDescription,
        })),
      };
    },
  },
  {
    name: "list_sessions",
    description: "List council sessions on a board, newest first.",
    scopes: ["sessions:read"],
    inputSchema: z.object({ boardId: z.string() }),
    handler: async ({ boardId }, ctx) => {
      const [board] = await db
        .select()
        .from(boardsTable)
        .where(eq(boardsTable.id, boardId))
        .limit(1);
      if (!board) throw new Error(`Board not found: ${boardId}`);
      await ensureTenantRole(ctx, board.tenantId, "VIEWER");
      const rows = await db
        .select()
        .from(advisorySessionsTable)
        .where(eq(advisorySessionsTable.boardId, boardId))
        .orderBy(desc(advisorySessionsTable.startedAt));
      return {
        sessions: rows.map((s) => ({
          id: s.id,
          mode: s.mode,
          questionText: s.questionText,
          status: s.status,
          startedAt: s.startedAt.toISOString(),
          completedAt: s.completedAt ? s.completedAt.toISOString() : null,
          parentSessionId: s.parentSessionId,
        })),
      };
    },
  },
  {
    name: "get_session_minutes",
    description:
      "Fetch the full minutes (chair framing, advisor contributions, summary) for a session as structured data.",
    scopes: ["sessions:read"],
    inputSchema: z.object({ sessionId: z.string() }),
    handler: async ({ sessionId }, ctx) => {
      const [s] = await db
        .select()
        .from(advisorySessionsTable)
        .where(eq(advisorySessionsTable.id, sessionId))
        .limit(1);
      if (!s) throw new Error(`Session not found: ${sessionId}`);
      await ensureTenantRole(ctx, s.tenantId, "VIEWER");
      const contribs = await db
        .select()
        .from(sessionContributionsTable)
        .where(eq(sessionContributionsTable.sessionId, sessionId))
        .orderBy(sessionContributionsTable.createdAt);
      const [summary] = await db
        .select()
        .from(sessionSummariesTable)
        .where(eq(sessionSummariesTable.sessionId, sessionId))
        .limit(1);
      return {
        session: {
          id: s.id,
          boardId: s.boardId,
          status: s.status,
          questionText: s.questionText,
          mode: s.mode,
        },
        contributions: contribs.map((c) => ({
          memberName: c.memberName,
          memberRoleTitle: c.memberRoleTitle,
          vote: c.vote,
          voteRationale: c.voteRationale,
          contributionText: c.contributionText,
        })),
        summary: summary
          ? {
              chairsFraming: summary.chairsFraming,
              convergenceNote: summary.convergenceNote,
              finalSummary: summary.finalSummary,
              openQuestionsText: summary.openQuestionsText,
              flagsRaisedText: summary.flagsRaisedText,
            }
          : null,
      };
    },
  },
  {
    name: "list_decisions",
    description: "List decisions recorded for a tenant or board.",
    scopes: ["decisions:read"],
    inputSchema: z.object({
      boardId: z.string().optional(),
    }),
    handler: async ({ boardId }, ctx) => {
      await ensureTenantRole(ctx, ctx.tenantId, "VIEWER");
      const conds = [eq(decisionsTable.tenantId, ctx.tenantId)];
      if (boardId) conds.push(eq(decisionsTable.boardId, boardId));
      const rows = await db
        .select()
        .from(decisionsTable)
        .where(and(...conds))
        .orderBy(desc(decisionsTable.decidedAt));
      return {
        decisions: rows.map((d) => ({
          id: d.id,
          boardId: d.boardId,
          sessionId: d.sessionId,
          questionText: d.questionText,
          recommendationText: d.recommendationText,
          status: d.status,
          decidedAt: d.decidedAt.toISOString(),
        })),
      };
    },
  },
  {
    name: "convene_session",
    description:
      "Convene the council on a question. Returns immediately with a sessionId; use wait_for_session_completion to read final minutes.",
    scopes: ["sessions:write"],
    inputSchema: z.object({
      boardId: z.string(),
      question: z.string().min(3),
      mode: z.enum(["ADVISORY", "BOARD", "REVIEW"]).optional(),
      allHands: z.boolean().optional(),
    }),
    handler: async ({ boardId, question, mode, allHands }, ctx) => {
      const [board] = await db
        .select()
        .from(boardsTable)
        .where(eq(boardsTable.id, boardId))
        .limit(1);
      if (!board) throw new Error(`Board not found: ${boardId}`);
      await ensureTenantRole(ctx, board.tenantId, "EDITOR");

      const memberCount = (
        await db
          .select({ id: boardMembersTable.id })
          .from(boardMembersTable)
          .where(eq(boardMembersTable.boardId, boardId))
      ).length;
      if (memberCount === 0) {
        throw new Error("Board has no seated advisors.");
      }
      const resolvedMode = mode ?? "ADVISORY";
      const [session] = await db
        .insert(advisorySessionsTable)
        .values({
          tenantId: board.tenantId,
          boardId: board.id,
          mode: resolvedMode,
          questionText: question,
          status: "running",
          createdBy: ctx.userId,
          allHands: Boolean(allHands),
        })
        .returning();
      void runSession({
        sessionId: session.id,
        tenantId: board.tenantId,
        boardId: board.id,
        mode: resolvedMode,
        question,
        allHands: Boolean(allHands),
      }).catch(() => undefined);
      return {
        sessionId: session.id,
        statusUrl: `quorum://sessions/${session.id}`,
        status: "running",
      };
    },
  },
  {
    name: "wait_for_session_completion",
    description:
      "Block until the given session reaches a terminal state, then return its final minutes. Polls roughly every 2 seconds.",
    scopes: ["sessions:read"],
    inputSchema: z.object({
      sessionId: z.string(),
      timeoutSeconds: z.number().int().min(5).max(900).optional(),
    }),
    handler: async ({ sessionId, timeoutSeconds }, ctx) => {
      const [s0] = await db
        .select()
        .from(advisorySessionsTable)
        .where(eq(advisorySessionsTable.id, sessionId))
        .limit(1);
      if (!s0) throw new Error(`Session not found: ${sessionId}`);
      await ensureTenantRole(ctx, s0.tenantId, "VIEWER");

      const deadline = Date.now() + (timeoutSeconds ?? 300) * 1000;
      // Hook into the live progress channel as a "best effort" early-exit
      // (the loop is the source of truth).
      const unsubscribe = subscribeToSession(sessionId, () => undefined);
      try {
        // Polling loop — simple and robust across transports.
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const [s] = await db
            .select()
            .from(advisorySessionsTable)
            .where(eq(advisorySessionsTable.id, sessionId))
            .limit(1);
          if (!s) throw new Error(`Session disappeared: ${sessionId}`);
          if (s.status !== "running") {
            const [summary] = await db
              .select()
              .from(sessionSummariesTable)
              .where(eq(sessionSummariesTable.sessionId, sessionId))
              .limit(1);
            return {
              status: s.status,
              questionText: s.questionText,
              finalSummary: summary?.finalSummary ?? null,
              convergenceNote: summary?.convergenceNote ?? null,
              openQuestions: summary?.openQuestionsText ?? null,
              completedAt: s.completedAt?.toISOString() ?? null,
            };
          }
          if (Date.now() > deadline) {
            return { status: "timeout", sessionId };
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      } finally {
        unsubscribe();
      }
    },
  },
  {
    name: "branch_session",
    description:
      "Branch a completed session by re-asking its question with a new framing note.",
    scopes: ["sessions:write"],
    inputSchema: z.object({
      parentSessionId: z.string(),
      branchNote: z.string().min(3),
      questionText: z.string().min(3).optional(),
    }),
    handler: async ({ parentSessionId, branchNote, questionText }, ctx) => {
      const [parent] = await db
        .select()
        .from(advisorySessionsTable)
        .where(eq(advisorySessionsTable.id, parentSessionId))
        .limit(1);
      if (!parent) throw new Error(`Parent session not found: ${parentSessionId}`);
      if (parent.status !== "complete") {
        throw new Error("Only completed sessions can be branched.");
      }
      await ensureTenantRole(ctx, parent.tenantId, "EDITOR");
      const [parentSummary] = await db
        .select()
        .from(sessionSummariesTable)
        .where(eq(sessionSummariesTable.sessionId, parent.id))
        .limit(1);
      const [child] = await db
        .insert(advisorySessionsTable)
        .values({
          tenantId: parent.tenantId,
          boardId: parent.boardId,
          mode: parent.mode,
          questionText: questionText ?? parent.questionText,
          status: "running",
          createdBy: ctx.userId,
          parentSessionId: parent.id,
          branchNote,
          allHands: parent.allHands,
        })
        .returning();
      void runSession({
        sessionId: child.id,
        tenantId: parent.tenantId,
        boardId: parent.boardId,
        mode: parent.mode as "ADVISORY" | "BOARD" | "REVIEW",
        question: questionText ?? parent.questionText,
        allHands: parent.allHands,
        branchContext: {
          parentQuestion: parent.questionText,
          parentFinalSummary: parentSummary?.finalSummary ?? null,
          parentConvergenceNote: parentSummary?.convergenceNote ?? null,
          branchNote,
        },
      }).catch(() => undefined);
      return { sessionId: child.id, status: "running" };
    },
  },
  {
    name: "record_decision_outcome",
    description:
      "Record a follow-up outcome on a decision (e.g. acted/declined/overridden) with an optional note.",
    scopes: ["decisions:write"],
    inputSchema: z.object({
      decisionId: z.string(),
      tag: z.enum(["RIGHT", "WRONG", "MIXED", "TOO_EARLY"]),
      note: z.string().optional(),
      status: z.enum(["PENDING", "ACTED", "DECLINED", "OVERRIDDEN"]).optional(),
    }),
    handler: async ({ decisionId, tag, note, status }, ctx) => {
      const [decision] = await db
        .select()
        .from(decisionsTable)
        .where(eq(decisionsTable.id, decisionId))
        .limit(1);
      if (!decision) throw new Error(`Decision not found: ${decisionId}`);
      await ensureTenantRole(ctx, decision.tenantId, "EDITOR");
      const [existing] = await db
        .select()
        .from(decisionOutcomesTable)
        .where(eq(decisionOutcomesTable.decisionId, decisionId))
        .limit(1);
      if (existing) {
        await db
          .update(decisionOutcomesTable)
          .set({
            tag,
            noteText: note ?? null,
            recordedBy: ctx.userId,
            updatedAt: new Date(),
          })
          .where(eq(decisionOutcomesTable.id, existing.id));
      } else {
        await db.insert(decisionOutcomesTable).values({
          decisionId,
          tag,
          noteText: note ?? null,
          recordedBy: ctx.userId,
        });
      }
      if (status) {
        await db
          .update(decisionsTable)
          .set({ status, updatedAt: new Date() })
          .where(eq(decisionsTable.id, decisionId));
      }
      return { decisionId, tag, status: status ?? decision.status };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────
// Resources
// ─────────────────────────────────────────────────────────────────────

const resources: McpResourceDef[] = [
  {
    uri: "quorum://tenants/current",
    name: "Current workspace",
    description: "Overview of the workspace bound to this MCP session.",
    mimeType: "text/markdown",
    scopes: ["boards:read"],
    handler: async (_uri, ctx) => {
      const [t] = await db
        .select()
        .from(tenantsTable)
        .where(eq(tenantsTable.id, ctx.tenantId))
        .limit(1);
      if (!t) return { text: "Workspace not found." };
      const boards = await db
        .select()
        .from(boardsTable)
        .where(eq(boardsTable.tenantId, t.id));
      const lines = [
        `# ${t.name}`,
        ``,
        `Slug: \`${t.slug}\``,
        ``,
        `## Boards`,
        ...boards.map((b) => `- **${b.name}** — ${b.description ?? "(no description)"}`),
      ];
      return { text: lines.join("\n") };
    },
  },
  {
    uri: "quorum://boards/{boardId}",
    uriTemplate: "quorum://boards/{boardId}",
    name: "Board",
    description: "Board detail (markdown) including seated advisors.",
    mimeType: "text/markdown",
    scopes: ["boards:read"],
    handler: async (uri, ctx) => {
      const vars = extractTemplateVars("quorum://boards/{boardId}", uri);
      if (!vars) throw new Error(`Bad URI: ${uri}`);
      const [board] = await db
        .select()
        .from(boardsTable)
        .where(eq(boardsTable.id, vars.boardId))
        .limit(1);
      if (!board) throw new Error(`Board not found: ${vars.boardId}`);
      await ensureTenantRole(ctx, board.tenantId, "VIEWER");
      const members = await db
        .select()
        .from(boardMembersTable)
        .where(eq(boardMembersTable.boardId, board.id))
        .orderBy(boardMembersTable.ordering);
      const lines = [
        `# ${board.name}`,
        board.description ? `\n${board.description}` : "",
        `\n## Master prompt\n\n${board.masterInstructionsText ?? "(default)"}`,
        `\n## Seated advisors`,
        ...members.map(
          (m) =>
            `### ${m.name} — ${m.roleTitle}\n\n${m.lensDescription ?? ""}\n\n${
              m.instructionsText ?? ""
            }`,
        ),
      ];
      return { text: lines.filter(Boolean).join("\n") };
    },
  },
  {
    uri: "quorum://sessions/{sessionId}",
    uriTemplate: "quorum://sessions/{sessionId}",
    name: "Session minutes",
    description: "Full session minutes as markdown.",
    mimeType: "text/markdown",
    scopes: ["sessions:read"],
    handler: async (uri, ctx) => {
      const vars = extractTemplateVars("quorum://sessions/{sessionId}", uri);
      if (!vars) throw new Error(`Bad URI: ${uri}`);
      const [s] = await db
        .select()
        .from(advisorySessionsTable)
        .where(eq(advisorySessionsTable.id, vars.sessionId))
        .limit(1);
      if (!s) throw new Error(`Session not found: ${vars.sessionId}`);
      await ensureTenantRole(ctx, s.tenantId, "VIEWER");
      const contribs = await db
        .select()
        .from(sessionContributionsTable)
        .where(eq(sessionContributionsTable.sessionId, s.id))
        .orderBy(sessionContributionsTable.createdAt);
      const [summary] = await db
        .select()
        .from(sessionSummariesTable)
        .where(eq(sessionSummariesTable.sessionId, s.id))
        .limit(1);
      const lines = [
        `# Council session ${s.id.slice(0, 8)}`,
        ``,
        `**Question:** ${s.questionText}`,
        `**Status:** ${s.status}`,
        ``,
        summary?.chairsFraming ? `## Chair's framing\n\n${summary.chairsFraming}` : "",
        `\n## Contributions`,
        ...contribs.map(
          (c) =>
            `### ${c.memberName} — ${c.memberRoleTitle}\n\n_Vote: ${
              c.vote ?? "—"
            }_\n\n${c.contributionText ?? ""}`,
        ),
        summary?.convergenceNote
          ? `\n## Convergence\n\n${summary.convergenceNote}`
          : "",
        summary?.finalSummary ? `\n## Final summary\n\n${summary.finalSummary}` : "",
        summary?.openQuestionsText
          ? `\n## Open questions\n\n${summary.openQuestionsText}`
          : "",
      ];
      return { text: lines.filter(Boolean).join("\n") };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────

const prompts: McpPromptDef[] = [
  {
    name: "brief_me_on_board",
    description:
      "Generate a request for the assistant to brief the user on a specific board.",
    arguments: [
      { name: "boardName", description: "Name of the board.", required: true },
    ],
    handler: async ({ boardName }) => ({
      description: `Brief on ${boardName}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Use the Quorum MCP tools to look up the board called "${boardName}", read its seated advisors, and brief me on its purpose, members, and most recent sessions. Cite the boardId in your answer.`,
          },
        },
      ],
    }),
  },
  {
    name: "convene_council_on_question",
    description: "Ask the council a question and walk the user through the result.",
    arguments: [
      { name: "boardName", description: "Board to convene.", required: true },
      { name: "question", description: "Question to ask.", required: true },
    ],
    handler: async ({ boardName, question }) => ({
      description: `Convene ${boardName}`,
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Find the board named "${boardName}" via list_boards. Convene it on this question: "${question}". Wait for the session to complete (wait_for_session_completion), then summarize the chair's framing, each advisor's stance and vote, the convergence note, and any open questions. Cite the sessionId.`,
          },
        },
      ],
    }),
  },
];

// ─────────────────────────────────────────────────────────────────────
// Server
// ─────────────────────────────────────────────────────────────────────

export const mcpServer = createMcpServer({
  name: "quorum-mcp",
  version: "0.1.0",
  instructions:
    "Quorum is a multi-tenant Board of Advisors. Tools let you list boards, read minutes, convene sessions, branch them, and record decision outcomes. All operations are scoped to one workspace.",
  tools,
  resources,
  prompts,
  authenticate: async (req) => {
    const apiKeyCtx = await authenticateApiKey(req);
    if (apiKeyCtx) return apiKeyCtx;
    return authenticateSession(req);
  },
});
