import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  advisorySessionsTable,
  sessionContributionsTable,
  sessionSummariesTable,
  boardsTable,
  tenantAudioSettingsTable,
  sessionAudioTable,
  tenantsTable,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireTenantRole } from "../lib/tenantAuth";
import {
  composeScript,
  estimateCostCents,
  synthesizeScript,
  type ComposeInput,
} from "../lib/audioComposer";
import { objectStorageClient } from "../lib/objectStorage";
import { randomUUID } from "node:crypto";
import { signBoardFeedToken, verifyBoardFeedToken } from "../lib/feedToken";
import { isOpenAIConfigured } from "../lib/openai";

const router: IRouter = Router();

const PRIVATE_DIR = process.env.PRIVATE_OBJECT_DIR || "";

function parseObjectPath(p: string): { bucketName: string; objectName: string } {
  const path = p.startsWith("/") ? p : `/${p}`;
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) throw new Error(`Invalid object path: ${p}`);
  return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
}

async function uploadAudio(buf: Buffer, sessionId: string): Promise<string> {
  if (!PRIVATE_DIR) {
    throw new Error("PRIVATE_OBJECT_DIR is not set; cannot store audio");
  }
  const audioId = `${sessionId}-${randomUUID().slice(0, 8)}`;
  const fullPath = `${PRIVATE_DIR.replace(/\/$/, "")}/audio/${audioId}.mp3`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(buf, {
    contentType: "audio/mpeg",
    resumable: false,
    metadata: { contentType: "audio/mpeg" },
  });
  return `audio/${audioId}.mp3`;
}

async function downloadAudio(storagePath: string): Promise<Buffer> {
  const fullPath = `${PRIVATE_DIR.replace(/\/$/, "")}/${storagePath}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  const [contents] = await file.download();
  return contents;
}

async function deleteAudioFile(storagePath: string): Promise<void> {
  const fullPath = `${PRIVATE_DIR.replace(/\/$/, "")}/${storagePath}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  try {
    await file.delete({ ignoreNotFound: true });
  } catch {
    // best effort
  }
}

function serializeAudio(a: typeof sessionAudioTable.$inferSelect, sessionId: string) {
  return {
    id: a.id,
    sessionId: a.sessionId,
    durationSeconds: a.durationSeconds,
    bytes: a.bytes,
    voicesUsed: a.voicesUsed ?? [],
    sections: a.sections ?? [],
    costCents: a.costCents,
    status: a.status,
    errorDetail: a.errorDetail,
    createdAt: a.createdAt.toISOString(),
    audioUrl: `/api/sessions/${sessionId}/audio/file`,
    transcriptUrl: `/api/sessions/${sessionId}/audio/transcript`,
  };
}

// ---- Tenant audio settings -------------------------------------------------

router.get("/tenants/:tenantId/audio-settings", async (req, res) => {
  const tenantId = req.params.tenantId as string;
  const ctx = await requireTenantRole(req, res, tenantId, "VIEWER");
  if (!ctx) return;
  const [row] = await db
    .select()
    .from(tenantAudioSettingsTable)
    .where(eq(tenantAudioSettingsTable.tenantId, tenantId))
    .limit(1);
  res.json({
    tenantId,
    enabled: row?.enabled ?? false,
    feedTitle: row?.feedTitle ?? null,
    feedAuthor: row?.feedAuthor ?? null,
    updatedAt: (row?.updatedAt ?? new Date()).toISOString(),
  });
});

router.patch("/tenants/:tenantId/audio-settings", async (req, res) => {
  const tenantId = req.params.tenantId as string;
  const ctx = await requireTenantRole(req, res, tenantId, "ADMIN");
  if (!ctx) return;
  const body = req.body as {
    enabled?: boolean;
    feedTitle?: string | null;
    feedAuthor?: string | null;
  };
  const values = {
    tenantId,
    enabled: body.enabled ?? false,
    feedTitle: body.feedTitle ?? null,
    feedAuthor: body.feedAuthor ?? null,
    updatedAt: new Date(),
  };
  const existing = await db
    .select()
    .from(tenantAudioSettingsTable)
    .where(eq(tenantAudioSettingsTable.tenantId, tenantId))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(tenantAudioSettingsTable).values(values);
  } else {
    await db
      .update(tenantAudioSettingsTable)
      .set(values)
      .where(eq(tenantAudioSettingsTable.tenantId, tenantId));
  }
  res.json({
    tenantId,
    enabled: values.enabled,
    feedTitle: values.feedTitle,
    feedAuthor: values.feedAuthor,
    updatedAt: values.updatedAt.toISOString(),
  });
});

// ---- Helpers ---------------------------------------------------------------

async function loadSessionForCompose(sessionId: string): Promise<
  | {
      session: typeof advisorySessionsTable.$inferSelect;
      board: typeof boardsTable.$inferSelect;
      input: ComposeInput;
    }
  | null
> {
  const [session] = await db
    .select()
    .from(advisorySessionsTable)
    .where(eq(advisorySessionsTable.id, sessionId))
    .limit(1);
  if (!session) return null;
  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, session.boardId))
    .limit(1);
  if (!board) return null;
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
    session,
    board,
    input: {
      questionText: session.questionText,
      boardName: board.name,
      mode: session.mode,
      chairsFraming: summary?.chairsFraming ?? null,
      convergenceNote: summary?.convergenceNote ?? null,
      contributions: contribs.map((c) => ({
        memberName: c.memberName,
        memberRoleTitle: c.memberRoleTitle,
        contributionText: c.contributionText,
        vote: c.vote,
      })),
    },
  };
}

// ---- Estimate (preview cost & duration) ------------------------------------

router.get("/sessions/:sessionId/audio/estimate", async (req, res) => {
  const data = await loadSessionForCompose(req.params.sessionId as string);
  if (!data) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, data.session.tenantId, "VIEWER");
  if (!ctx) return;
  const script = composeScript(data.input);
  const [settings] = await db
    .select()
    .from(tenantAudioSettingsTable)
    .where(eq(tenantAudioSettingsTable.tenantId, data.session.tenantId))
    .limit(1);
  res.json({
    estimatedSeconds: script.estimatedSeconds,
    estimatedCostCents: estimateCostCents(script),
    voiceCount: script.voicesUsed.length,
    lineCount: script.lines.length,
    enabled: (settings?.enabled ?? false) && isOpenAIConfigured(),
    integrationConfigured: isOpenAIConfigured(),
  });
});

// ---- Generate --------------------------------------------------------------

router.post("/sessions/:sessionId/audio", async (req, res) => {
  const sessionId = req.params.sessionId as string;
  const data = await loadSessionForCompose(sessionId);
  if (!data) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, data.session.tenantId, "EDITOR");
  if (!ctx) return;
  if (data.session.status !== "complete") {
    res.status(400).json({ error: "Session is not complete" });
    return;
  }

  const [settings] = await db
    .select()
    .from(tenantAudioSettingsTable)
    .where(eq(tenantAudioSettingsTable.tenantId, data.session.tenantId))
    .limit(1);
  if (!settings || !settings.enabled) {
    res.status(403).json({
      error: "Audio mode is disabled for this tenant. Enable it in Tenant Admin first.",
    });
    return;
  }
  if (!isOpenAIConfigured()) {
    res.status(503).json({
      error:
        "OpenAI integration is not provisioned on this server. Audio cannot be generated.",
    });
    return;
  }

  // If existing, delete (regenerate)
  const existing = await db
    .select()
    .from(sessionAudioTable)
    .where(eq(sessionAudioTable.sessionId, sessionId))
    .limit(1);
  for (const e of existing) {
    await deleteAudioFile(e.storagePath).catch(() => undefined);
  }
  await db.delete(sessionAudioTable).where(eq(sessionAudioTable.sessionId, sessionId));

  const script = composeScript(data.input);
  try {
    const synthesized = await synthesizeScript(script, req.log);
    const storagePath = await uploadAudio(synthesized.mp3, sessionId);
    const [row] = await db
      .insert(sessionAudioTable)
      .values({
        sessionId,
        tenantId: data.session.tenantId,
        boardId: data.session.boardId,
        storagePath,
        durationSeconds: synthesized.durationSeconds,
        bytes: synthesized.mp3.length,
        voicesUsed: synthesized.voicesUsed,
        sections: synthesized.sections,
        costCents: synthesized.costCents,
        transcriptText: synthesized.transcript,
        status: "ready",
      })
      .returning();
    res.status(201).json(serializeAudio(row, sessionId));
  } catch (err) {
    req.log.error({ err, sessionId }, "Audio synthesis failed");
    res.status(500).json({
      error: "Failed to synthesize audio",
      detail: err instanceof Error ? err.message : "unknown",
    });
  }
});

// ---- Get audio metadata ----------------------------------------------------

router.get("/sessions/:sessionId/audio", async (req, res) => {
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
  const [row] = await db
    .select()
    .from(sessionAudioTable)
    .where(eq(sessionAudioTable.sessionId, sessionId))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "No audio for this session" });
    return;
  }
  res.json(serializeAudio(row, sessionId));
});

// ---- Stream audio file -----------------------------------------------------
// Two access modes:
//   1) Authenticated tenant member (browser, in-app player) — VIEWER role.
//   2) Public RSS enclosure: ?token=<board-scoped HMAC>. Required so that
//      podcast apps (Apple Podcasts, Overcast, Spotify) — which do not carry
//      browser cookies — can play audio when subscribed to the board's feed.
router.get("/sessions/:sessionId/audio/file", async (req, res) => {
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
  const token = (req.query.token as string | undefined) ?? "";
  const tokenOk = token && verifyBoardFeedToken(session.boardId, token);
  if (!tokenOk) {
    const ctx = await requireTenantRole(req, res, session.tenantId, "VIEWER");
    if (!ctx) return;
  }
  const [row] = await db
    .select()
    .from(sessionAudioTable)
    .where(eq(sessionAudioTable.sessionId, sessionId))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "No audio" });
    return;
  }
  try {
    const buf = await downloadAudio(row.storagePath);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader(
      "Cache-Control",
      tokenOk ? "public, max-age=3600" : "private, max-age=3600",
    );
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="quorum-${sessionId.slice(0, 8)}.mp3"`,
    );
    res.end(buf);
  } catch (err) {
    req.log.error({ err }, "Failed to stream audio");
    res.status(500).json({ error: "Failed to read audio" });
  }
});

// ---- Transcript ------------------------------------------------------------

router.get("/sessions/:sessionId/audio/transcript", async (req, res) => {
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
  const [row] = await db
    .select()
    .from(sessionAudioTable)
    .where(eq(sessionAudioTable.sessionId, sessionId))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "No audio" });
    return;
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(row.transcriptText ?? "");
});

// ---- Delete ----------------------------------------------------------------

router.delete("/sessions/:sessionId/audio", async (req, res) => {
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
  const ctx = await requireTenantRole(req, res, session.tenantId, "EDITOR");
  if (!ctx) return;
  const [row] = await db
    .select()
    .from(sessionAudioTable)
    .where(eq(sessionAudioTable.sessionId, sessionId))
    .limit(1);
  if (row) {
    await deleteAudioFile(row.storagePath).catch(() => undefined);
    await db.delete(sessionAudioTable).where(eq(sessionAudioTable.sessionId, sessionId));
  }
  res.status(204).end();
});

// ---- Per-board RSS feed ----------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function publicBaseUrl(req: Request): string {
  const host = req.get("host");
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  return `${proto}://${host}`;
}

// Endpoint that returns a tokenized public feed URL — used by the in-app
// "Subscribe in podcast app" button. Requires tenant VIEWER role to mint.
router.get("/boards/:boardId/audio/feed-url", async (req, res) => {
  const boardId = req.params.boardId as string;
  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, boardId))
    .limit(1);
  if (!board) {
    res.status(404).json({ error: "Board not found" });
    return;
  }
  const ctx = await requireTenantRole(req, res, board.tenantId, "VIEWER");
  if (!ctx) return;
  const token = signBoardFeedToken(boardId);
  const base = publicBaseUrl(req);
  res.json({
    feedUrl: `${base}/api/boards/${boardId}/podcast.xml?token=${token}`,
    token,
  });
});

// RSS feed: accepts EITHER ?token=<board-scoped HMAC> (for podcast apps) OR
// an authenticated tenant session.
router.get("/boards/:boardId/podcast.xml", async (req, res) => {
  const boardId = req.params.boardId as string;
  const [board] = await db
    .select()
    .from(boardsTable)
    .where(eq(boardsTable.id, boardId))
    .limit(1);
  if (!board) {
    res.status(404).type("text/plain").send("Board not found");
    return;
  }
  const [tenant] = await db
    .select()
    .from(tenantsTable)
    .where(eq(tenantsTable.id, board.tenantId))
    .limit(1);

  const reqToken = (req.query.token as string | undefined) ?? "";
  const tokenOk = reqToken && verifyBoardFeedToken(boardId, reqToken);
  if (!tokenOk) {
    const ctx = await requireTenantRole(req, res, board.tenantId, "VIEWER");
    if (!ctx) return;
  }
  // Token used in this response's enclosure URLs (mint a fresh one for cookie
  // auth callers; reuse the supplied token for token auth callers).
  const enclosureToken = tokenOk ? reqToken : signBoardFeedToken(boardId);

  const [settings] = await db
    .select()
    .from(tenantAudioSettingsTable)
    .where(eq(tenantAudioSettingsTable.tenantId, board.tenantId))
    .limit(1);

  const audioRows = await db
    .select({
      audio: sessionAudioTable,
      session: advisorySessionsTable,
    })
    .from(sessionAudioTable)
    .innerJoin(
      advisorySessionsTable,
      eq(sessionAudioTable.sessionId, advisorySessionsTable.id),
    )
    .where(
      and(
        eq(sessionAudioTable.boardId, boardId),
        eq(sessionAudioTable.status, "ready"),
      ),
    )
    .orderBy(desc(sessionAudioTable.createdAt));

  const base = publicBaseUrl(req);
  const feedTitle =
    settings?.feedTitle ||
    `${board.name} — Quorum Minutes${tenant ? ` (${tenant.name})` : ""}`;
  const feedAuthor = settings?.feedAuthor || tenant?.name || "Quorum";
  const feedDesc = board.description || `Podcast minutes for the ${board.name} board.`;
  const feedLink = `${base}/t/${board.tenantId}/boards/${board.id}`;
  const selfLink = `${base}/api/boards/${board.id}/podcast.xml`;

  const items = audioRows
    .map(({ audio, session }) => {
      const url = `${base}/api/sessions/${session.id}/audio/file?token=${enclosureToken}`;
      const title = `${session.questionText.slice(0, 80)}${
        session.questionText.length > 80 ? "…" : ""
      }`;
      const pub = audio.createdAt.toUTCString();
      return `
    <item>
      <title>${escapeXml(title)}</title>
      <description>${escapeXml(`Quorum minutes — ${session.mode} session.`)}</description>
      <pubDate>${pub}</pubDate>
      <guid isPermaLink="false">quorum-audio-${audio.id}</guid>
      <enclosure url="${escapeXml(url)}" length="${audio.bytes}" type="audio/mpeg" />
      <itunes:duration>${audio.durationSeconds}</itunes:duration>
      <link>${escapeXml(`${base}/sessions/${session.id}`)}</link>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(feedLink)}</link>
    <atom:link href="${escapeXml(selfLink)}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(feedDesc)}</description>
    <language>en-us</language>
    <itunes:author>${escapeXml(feedAuthor)}</itunes:author>
    <itunes:summary>${escapeXml(feedDesc)}</itunes:summary>
    <itunes:explicit>false</itunes:explicit>
    ${items}
  </channel>
</rss>`;

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    tokenOk ? "public, max-age=300" : "private, max-age=60",
  );
  res.send(xml);
});

export default router;
