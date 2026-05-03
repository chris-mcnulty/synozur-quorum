import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  advisorySessionsTable,
  sessionExportsTable,
  usersTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireTenantRole } from "../lib/tenantAuth";
import {
  loadMemoData,
  serializeMemo,
  renderMemoMarkdown,
  renderMemoSlackText,
  memoSectionsFor,
  type MemoData,
} from "../lib/memoData";
import { renderMemoToPdf } from "../lib/pdfRenderer";
import {
  getSlackToken,
  getNotionToken,
  listSlackChannelsApi,
  postSlackMessage,
  getSlackTeamName,
  listNotionParentPagesApi,
  createNotionPageApi,
  memoSectionsToNotionBlocks,
  getNotionWorkspaceName,
  errorMessage,
} from "../lib/connectors";

const router: IRouter = Router();

type AuthorizedMemo = {
  memo: MemoData;
  userId: string;
  userName: string | null;
};

async function loadAuthorizedMemo(
  req: Request,
  res: Response,
  opts: { requireComplete?: boolean } = {},
): Promise<AuthorizedMemo | null> {
  const sessionId = req.params.sessionId as string;
  const memo = await loadMemoData(sessionId);
  if (!memo) {
    res.status(404).json({ error: "Session not found" });
    return null;
  }
  const ctx = await requireTenantRole(req, res, memo.tenantId, "VIEWER");
  if (!ctx) return null;

  if (opts.requireComplete && memo.status !== "complete") {
    res.status(409).json({
      error:
        "This session is not yet complete. Memo, PDF, and exports are only available once a session has finished.",
    });
    return null;
  }

  let userName: string | null = null;
  try {
    const [u] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, ctx.userId))
      .limit(1);
    if (u) {
      userName =
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
        u.email ||
        null;
    }
  } catch {
    // If we can't resolve a name, fall back to userId-only attribution.
  }

  return { memo, userId: ctx.userId, userName };
}

function deepLinkFor(req: Request, sessionId: string): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "";
  return `${proto}://${host}/sessions/${sessionId}`;
}

function serializeExport(row: typeof sessionExportsTable.$inferSelect) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    kind: row.kind,
    target: row.target,
    targetUrl: row.targetUrl,
    status: row.status,
    errorDetail: row.errorDetail,
    exportedByName: row.exportedByName,
    createdAt: row.createdAt.toISOString(),
  };
}

async function logExport(args: {
  sessionId: string;
  tenantId: string;
  kind: string;
  target?: string | null;
  targetUrl?: string | null;
  status?: string;
  errorDetail?: string | null;
  exportedBy: string | null;
  exportedByName: string | null;
}) {
  const [row] = await db
    .insert(sessionExportsTable)
    .values({
      sessionId: args.sessionId,
      tenantId: args.tenantId,
      kind: args.kind,
      target: args.target ?? null,
      targetUrl: args.targetUrl ?? null,
      status: args.status ?? "succeeded",
      errorDetail: args.errorDetail ?? null,
      exportedBy: args.exportedBy,
      exportedByName: args.exportedByName,
    })
    .returning();
  return row!;
}

// ---- Memo data + markdown + pdf -------------------------------------------

router.get("/sessions/:sessionId/memo", async (req: Request, res: Response) => {
  const r = await loadAuthorizedMemo(req, res, { requireComplete: true });
  if (!r) return;
  res.json(serializeMemo(r.memo));
});

router.get("/sessions/:sessionId/memo.md", async (req: Request, res: Response) => {
  const r = await loadAuthorizedMemo(req, res, { requireComplete: true });
  if (!r) return;
  const md = renderMemoMarkdown(r.memo, { deepLink: deepLinkFor(req, r.memo.sessionId) });
  try {
    await logExport({
      sessionId: r.memo.sessionId,
      tenantId: r.memo.tenantId,
      kind: "MARKDOWN",
      target: "Copied markdown",
      exportedBy: r.userId,
      exportedByName: r.userName,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to log markdown export");
  }
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="memo-${r.memo.sessionId.slice(0, 8)}.md"`,
  );
  res.send(md);
});

router.get("/sessions/:sessionId/memo.pdf", async (req: Request, res: Response) => {
  const r = await loadAuthorizedMemo(req, res, { requireComplete: true });
  if (!r) return;
  try {
    const pdf = await renderMemoToPdf(serializeMemo(r.memo));
    await logExport({
      sessionId: r.memo.sessionId,
      tenantId: r.memo.tenantId,
      kind: "PDF",
      target: "Downloaded PDF",
      exportedBy: r.userId,
      exportedByName: r.userName,
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="memo-${r.memo.sessionId.slice(0, 8)}.pdf"`,
    );
    res.send(pdf);
  } catch (err) {
    req.log.error({ err }, "PDF render failed");
    res.status(500).json({ error: "Failed to render PDF" });
  }
});

router.get("/sessions/:sessionId/exports", async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const [session] = await db
    .select()
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.id, sessionId))
    .limit(1);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
  if (!ctx) return;

  const rows = await db
    .select()
    .from(sessionExportsTable)
    .where(eq(sessionExportsTable.sessionId, sessionId))
    .orderBy(desc(sessionExportsTable.createdAt));
  res.json(rows.map(serializeExport));
});

// ---- Slack -----------------------------------------------------------------

router.post("/sessions/:sessionId/export/slack", async (req: Request, res: Response) => {
  const r = await loadAuthorizedMemo(req, res, { requireComplete: true });
  if (!r) return;

  const body = (req.body ?? {}) as { channelId?: unknown; channelName?: unknown };
  const channelId = typeof body.channelId === "string" ? body.channelId : "";
  const channelName = typeof body.channelName === "string" ? body.channelName : null;
  if (!channelId) {
    res.status(400).json({ error: "channelId is required" });
    return;
  }

  const tok = await getSlackToken();
  if (!tok) {
    res.status(412).json({ error: "Slack is not connected. Connect Slack in Replit integrations." });
    return;
  }

  const link = deepLinkFor(req, r.memo.sessionId);
  const text = renderMemoSlackText(r.memo, link);

  try {
    const post = await postSlackMessage(tok.accessToken, channelId, text);
    const targetLabel = channelName ? `#${channelName.replace(/^#/, "")}` : channelId;
    const row = await logExport({
      sessionId: r.memo.sessionId,
      tenantId: r.memo.tenantId,
      kind: "SLACK",
      target: targetLabel,
      targetUrl: post.permalink,
      exportedBy: r.userId,
      exportedByName: r.userName,
    });
    res.json(serializeExport(row));
  } catch (err) {
    req.log.error({ err }, "Slack export failed");
    const row = await logExport({
      sessionId: r.memo.sessionId,
      tenantId: r.memo.tenantId,
      kind: "SLACK",
      target: channelName ?? channelId,
      status: "failed",
      errorDetail: errorMessage(err),
      exportedBy: r.userId,
      exportedByName: r.userName,
    });
    res.status(502).json(serializeExport(row));
  }
});

// ---- Notion ----------------------------------------------------------------

router.post("/sessions/:sessionId/export/notion", async (req: Request, res: Response) => {
  const r = await loadAuthorizedMemo(req, res, { requireComplete: true });
  if (!r) return;

  const body = (req.body ?? {}) as { parentPageId?: unknown; parentPageTitle?: unknown };
  const parentPageId = typeof body.parentPageId === "string" ? body.parentPageId : "";
  const parentPageTitle =
    typeof body.parentPageTitle === "string" ? body.parentPageTitle : null;
  if (!parentPageId) {
    res.status(400).json({ error: "parentPageId is required" });
    return;
  }

  const tok = await getNotionToken();
  if (!tok) {
    res
      .status(412)
      .json({ error: "Notion is not connected. Connect Notion in Replit integrations." });
    return;
  }

  const title = `${r.memo.boardName} — ${r.memo.questionText.slice(0, 80)}`;
  const blocks = memoSectionsToNotionBlocks(memoSectionsFor(r.memo));

  try {
    const created = await createNotionPageApi(tok.accessToken, parentPageId, title, blocks);
    const row = await logExport({
      sessionId: r.memo.sessionId,
      tenantId: r.memo.tenantId,
      kind: "NOTION",
      target: parentPageTitle ?? "Notion page",
      targetUrl: created.url,
      exportedBy: r.userId,
      exportedByName: r.userName,
    });
    res.json(serializeExport(row));
  } catch (err) {
    req.log.error({ err }, "Notion export failed");
    const row = await logExport({
      sessionId: r.memo.sessionId,
      tenantId: r.memo.tenantId,
      kind: "NOTION",
      target: parentPageTitle ?? null,
      status: "failed",
      errorDetail: errorMessage(err),
      exportedBy: r.userId,
      exportedByName: r.userName,
    });
    res.status(502).json(serializeExport(row));
  }
});

// ---- Integrations status + listings ---------------------------------------

router.get("/integrations/status", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [slackTok, notionTok] = await Promise.all([getSlackToken(), getNotionToken()]);
  const [slackName, notionName] = await Promise.all([
    slackTok ? getSlackTeamName(slackTok.accessToken).catch(() => null) : Promise.resolve(null),
    notionTok
      ? getNotionWorkspaceName(notionTok.accessToken).catch(() => null)
      : Promise.resolve(null),
  ]);
  res.json({
    slack: { connected: !!slackTok, workspaceName: slackName },
    notion: { connected: !!notionTok, workspaceName: notionName },
  });
});

router.get("/integrations/slack/channels", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const tok = await getSlackToken();
  if (!tok) {
    res.status(412).json({ error: "Slack is not connected" });
    return;
  }
  try {
    const channels = await listSlackChannelsApi(tok.accessToken);
    res.json(channels);
  } catch (err) {
    req.log.error({ err }, "Slack channel listing failed");
    res.status(502).json({ error: errorMessage(err, "Slack API error") });
  }
});

router.get("/integrations/notion/pages", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const tok = await getNotionToken();
  if (!tok) {
    res.status(412).json({ error: "Notion is not connected" });
    return;
  }
  try {
    const pages = await listNotionParentPagesApi(tok.accessToken);
    res.json(pages);
  } catch (err) {
    req.log.error({ err }, "Notion page listing failed");
    res.status(502).json({ error: errorMessage(err, "Notion API error") });
  }
});

export default router;
