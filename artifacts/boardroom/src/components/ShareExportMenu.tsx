import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Share2, FileText, Hash, BookOpen, Copy, Loader2, ExternalLink, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetSessionMemo,
  useGetIntegrationsStatus,
  useListSlackChannels,
  useListNotionParentPages,
  useExportSessionToSlack,
  useExportSessionToNotion,
  getListSessionExportsQueryKey,
  getListSlackChannelsQueryKey,
  getListNotionParentPagesQueryKey,
  getSessionMemoMarkdown,
} from "@workspace/api-client-react";
import { SessionMemo } from "./SessionMemo";

type DialogKind = null | "memo" | "slack" | "notion";

export function ShareExportMenu({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState<DialogKind>(null);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const refreshExportsLog = () =>
    queryClient.invalidateQueries({
      queryKey: getListSessionExportsQueryKey(sessionId),
    });

  const handleCopyMarkdown = async () => {
    try {
      const md = await getSessionMemoMarkdown(sessionId);
      const text = typeof md === "string" ? md : String(md);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // Server logs the export when the .md endpoint is hit; reflect it in the UI.
      await refreshExportsLog();
    } catch (err) {
      console.error("Failed to copy markdown", err);
    }
  };

  const handleDownloadPdf = () => {
    // Server-side rendered for fidelity; opens in a new tab and triggers download.
    const url = `/api/sessions/${sessionId}/memo.pdf`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // The server logs the download; refresh after a beat so it's visible immediately.
    setTimeout(() => {
      void refreshExportsLog();
    }, 800);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors flex items-center gap-1.5"
            style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
            data-testid="share-export-trigger"
          >
            <Share2 className="w-3 h-3" />
            Share / Export
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="boa-mono text-[10px] uppercase tracking-wider">
            Memo
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setOpen("memo")}>
            <FileText className="w-4 h-4 mr-2" /> Preview one-page memo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleDownloadPdf}>
            <FileText className="w-4 h-4 mr-2" /> Download PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleCopyMarkdown}>
            {copied ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <Copy className="w-4 h-4 mr-2" />
            )}
            {copied ? "Copied" : "Copy Markdown summary"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="boa-mono text-[10px] uppercase tracking-wider">
            Send to
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setOpen("slack")}>
            <Hash className="w-4 h-4 mr-2" /> Post to Slack…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setOpen("notion")}>
            <BookOpen className="w-4 h-4 mr-2" /> Push to Notion…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {open === "memo" && (
        <MemoPreviewDialog
          sessionId={sessionId}
          onClose={() => setOpen(null)}
          onDownloadPdf={handleDownloadPdf}
        />
      )}
      {open === "slack" && (
        <SlackExportDialog sessionId={sessionId} onClose={() => setOpen(null)} />
      )}
      {open === "notion" && (
        <NotionExportDialog sessionId={sessionId} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

// -- Memo preview ------------------------------------------------------------

function MemoPreviewDialog({
  sessionId,
  onClose,
  onDownloadPdf,
}: {
  sessionId: string;
  onClose: () => void;
  onDownloadPdf: () => void;
}) {
  const { data, isLoading } = useGetSessionMemo(sessionId);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[860px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Board memo preview</DialogTitle>
          <DialogDescription>
            One-page board memo · print-ready · PDF rendered server-side.
          </DialogDescription>
        </DialogHeader>
        {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
        {data && <SessionMemo memo={data} />}
        <DialogFooter>
          <button
            className="boa-mono text-[11px] uppercase tracking-wider px-3 py-2 border rounded-sm hover:bg-[color:var(--boa-paper-2)]"
            onClick={onDownloadPdf}
          >
            Download PDF
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -- Slack -------------------------------------------------------------------

function SlackExportDialog({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: status, isLoading: statusLoading } = useGetIntegrationsStatus();
  const connected = !!status?.slack?.connected;
  const channelsQuery = useListSlackChannels({
    query: { enabled: connected, retry: false, queryKey: getListSlackChannelsQueryKey() },
  });
  const [channelId, setChannelId] = useState<string>("");
  const [channelName, setChannelName] = useState<string>("");
  const mut = useExportSessionToSlack();

  const onPost = async () => {
    if (!channelId) return;
    try {
      await mut.mutateAsync({
        sessionId,
        data: { channelId, channelName: channelName || null },
      });
      await queryClient.invalidateQueries({
        queryKey: getListSessionExportsQueryKey(sessionId),
      });
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Post memo digest to Slack</DialogTitle>
          <DialogDescription>
            {connected && status?.slack?.workspaceName
              ? `Connected workspace: ${status.slack.workspaceName}`
              : "Choose a Slack channel to receive a formatted digest with a deep link back to Quorum."}
          </DialogDescription>
        </DialogHeader>

        {statusLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : !connected ? (
          <ConnectorPrompt provider="Slack" />
        ) : channelsQuery.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : channelsQuery.error ? (
          <ErrorBanner message="Could not load Slack channels. Make sure the bot is invited or the scope allows listing channels." />
        ) : (
          <div className="space-y-3">
            <label
              className="boa-mono text-[10px] uppercase tracking-[0.18em] block"
              style={{ color: "var(--boa-ink-3)" }}
            >
              Channel
            </label>
            <select
              value={channelId}
              onChange={(e) => {
                setChannelId(e.target.value);
                const c = (channelsQuery.data ?? []).find((c) => c.id === e.target.value);
                setChannelName(c?.name ?? "");
              }}
              className="w-full border boa-rule rounded-sm px-3 py-2 text-[13px]"
              style={{ background: "var(--boa-paper)" }}
            >
              <option value="">Select a channel…</option>
              {(channelsQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.isPrivate ? "🔒 " : "#"}{c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <DialogFooter>
          <button
            className="boa-mono text-[11px] uppercase tracking-wider px-3 py-2 hover:underline"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="boa-mono text-[11px] uppercase tracking-wider px-3 py-2 border rounded-sm disabled:opacity-50"
            style={{ borderColor: "var(--boa-paper-3)" }}
            disabled={!connected || !channelId || mut.isPending}
            onClick={onPost}
          >
            {mut.isPending ? "Posting…" : "Post to Slack"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -- Notion ------------------------------------------------------------------

function NotionExportDialog({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: status, isLoading: statusLoading } = useGetIntegrationsStatus();
  const connected = !!status?.notion?.connected;
  const pagesQuery = useListNotionParentPages({
    query: { enabled: connected, retry: false, queryKey: getListNotionParentPagesQueryKey() },
  });
  const [pageId, setPageId] = useState<string>("");
  const [pageTitle, setPageTitle] = useState<string>("");
  const mut = useExportSessionToNotion();

  const onPush = async () => {
    if (!pageId) return;
    try {
      const res = await mut.mutateAsync({
        sessionId,
        data: { parentPageId: pageId, parentPageTitle: pageTitle || null },
      });
      await queryClient.invalidateQueries({
        queryKey: getListSessionExportsQueryKey(sessionId),
      });
      if (res?.targetUrl) window.open(res.targetUrl, "_blank", "noopener");
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Push memo to Notion</DialogTitle>
          <DialogDescription>
            {connected && status?.notion?.workspaceName
              ? `Connected workspace: ${status.notion.workspaceName}`
              : "Choose a parent page; a new Notion page will be created with the memo as native blocks."}
          </DialogDescription>
        </DialogHeader>

        {statusLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : !connected ? (
          <ConnectorPrompt provider="Notion" />
        ) : pagesQuery.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : pagesQuery.error ? (
          <ErrorBanner message="Could not load Notion pages. Ensure the integration has access to at least one page." />
        ) : (
          <div className="space-y-3">
            <label
              className="boa-mono text-[10px] uppercase tracking-[0.18em] block"
              style={{ color: "var(--boa-ink-3)" }}
            >
              Parent page
            </label>
            <select
              value={pageId}
              onChange={(e) => {
                setPageId(e.target.value);
                const p = (pagesQuery.data ?? []).find((p) => p.id === e.target.value);
                setPageTitle(p?.title ?? "");
              }}
              className="w-full border boa-rule rounded-sm px-3 py-2 text-[13px]"
              style={{ background: "var(--boa-paper)" }}
            >
              <option value="">Select a parent page…</option>
              {(pagesQuery.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <DialogFooter>
          <button
            className="boa-mono text-[11px] uppercase tracking-wider px-3 py-2 hover:underline"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="boa-mono text-[11px] uppercase tracking-wider px-3 py-2 border rounded-sm disabled:opacity-50"
            style={{ borderColor: "var(--boa-paper-3)" }}
            disabled={!connected || !pageId || mut.isPending}
            onClick={onPush}
          >
            {mut.isPending ? "Creating…" : "Create Notion page"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectorPrompt({ provider }: { provider: string }) {
  return (
    <div
      className="border boa-rule rounded-sm p-4 text-[13px] leading-relaxed"
      style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink-2)" }}
    >
      <div
        className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2"
        style={{ color: "var(--boa-brass)" }}
      >
        {provider} not connected
      </div>
      <p>
        Connect {provider} from the Replit integrations panel to enable this export.
        Your account-level OAuth token will be used securely; no credentials are stored
        in Quorum.
      </p>
      <a
        href="https://replit.com/integrations"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 boa-mono text-[10px] uppercase tracking-[0.18em] hover:underline"
        style={{ color: "var(--boa-brass)" }}
      >
        Open integrations <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="border rounded-sm p-3 text-[12px]"
      style={{ borderColor: "var(--boa-vote-no)", color: "var(--boa-vote-no)" }}
    >
      {message}
    </div>
  );
}
