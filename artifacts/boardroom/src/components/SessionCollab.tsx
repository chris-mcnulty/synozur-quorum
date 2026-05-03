import { useEffect, useState, useMemo } from "react";
import {
  useListSessionComments,
  useCreateSessionComment,
  useListSessionReactions,
  useToggleSessionReaction,
  useListFollowUpProposals,
  useCreateFollowUpProposal,
  useDispatchFollowUpProposal,
  useListSessionPresence,
  usePingSessionPresence,
  type SessionComment,
  type SessionReaction,
  type FollowUpProposal,
  type PresenceUser,
  type AnchorType,
  type ReactionKind,
} from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare,
  Send,
  Sparkles,
  ThumbsDown,
  Flag,
  GitBranch,
  X,
  Plus,
  CornerDownRight,
} from "lucide-react";

const REACTIONS: { kind: ReactionKind; label: string; icon: typeof Sparkles; color: string }[] = [
  { kind: "INSIGHTFUL", label: "Insightful", icon: Sparkles, color: "var(--boa-brass)" },
  { kind: "DISAGREE", label: "Disagree", icon: ThumbsDown, color: "var(--boa-vote-no)" },
  { kind: "ACTION", label: "Action", icon: Flag, color: "var(--boa-vote-yes)" },
];

function userInitials(p: { userDisplayName?: string | null; userEmail?: string | null }): string {
  const src = p.userDisplayName || p.userEmail || "?";
  const parts = src.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function PresenceStack({ sessionId }: { sessionId: string }) {
  const { isAuthenticated } = useAuth();
  const ping = usePingSessionPresence();
  const { data } = useListSessionPresence(sessionId, {
    query: {
      refetchInterval: 60_000,
      enabled: isAuthenticated,
      queryKey: ["/api/sessions", sessionId, "presence"],
    },
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    void ping.mutate({ sessionId });
    const t = setInterval(() => ping.mutate({ sessionId }), 15_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isAuthenticated]);

  const list: PresenceUser[] = data ?? [];
  if (list.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span
        className="boa-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: "var(--boa-ink-3)" }}
      >
        Watching
      </span>
      <div className="flex -space-x-2">
        {list.slice(0, 6).map((u) => (
          <div
            key={u.userId}
            title={u.displayName || u.email || u.userId}
            className="w-7 h-7 rounded-full flex items-center justify-center boa-mono text-[10px] border-2"
            style={{
              background: "var(--boa-brass)",
              color: "#1a1208",
              borderColor: "var(--boa-paper)",
            }}
          >
            {userInitials({ userDisplayName: u.displayName, userEmail: u.email })}
          </div>
        ))}
        {list.length > 6 && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center boa-mono text-[10px] border-2"
            style={{
              background: "var(--boa-paper-2)",
              color: "var(--boa-ink-2)",
              borderColor: "var(--boa-paper)",
            }}
          >
            +{list.length - 6}
          </div>
        )}
      </div>
    </div>
  );
}

interface AnchorCollabProps {
  sessionId: string;
  anchorType: AnchorType;
  anchorId: string;
}

export function AnchorReactions({ sessionId, anchorType, anchorId }: AnchorCollabProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: reactions } = useListSessionReactions(sessionId, {
    query: {
      refetchInterval: 60_000,
      queryKey: ["/api/sessions", sessionId, "reactions"],
    },
  });
  const toggle = useToggleSessionReaction({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "reactions"] });
      },
    },
  });

  const filtered = (reactions ?? []).filter(
    (r: SessionReaction) => r.anchorType === anchorType && r.anchorId === anchorId,
  );

  const counts = useMemo(() => {
    const m: Record<string, { count: number; mine: boolean }> = {};
    for (const r of filtered) {
      const k = r.reactionKind;
      if (!m[k]) m[k] = { count: 0, mine: false };
      m[k].count += 1;
      if (user && r.userId === user.id) m[k].mine = true;
    }
    return m;
  }, [filtered, user]);

  return (
    <div className="flex items-center gap-1.5 mt-3">
      {REACTIONS.map((r) => {
        const c = counts[r.kind];
        const mine = !!c?.mine;
        const Icon = r.icon;
        return (
          <button
            key={r.kind}
            onClick={() =>
              toggle.mutate({
                sessionId,
                data: { anchorType, anchorId, reactionKind: r.kind },
              })
            }
            disabled={toggle.isPending}
            className="boa-mono text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-sm border flex items-center gap-1.5 hover:bg-[color:var(--boa-paper-2)] transition-colors"
            style={{
              borderColor: mine ? r.color : "var(--boa-paper-3)",
              background: mine ? "rgba(189,142,84,0.08)" : "transparent",
              color: mine ? r.color : "var(--boa-ink-3)",
            }}
            title={r.label}
          >
            <Icon className="w-3 h-3" />
            {r.label}
            {c && c.count > 0 ? <span className="ml-0.5">{c.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

interface CommentNode extends SessionComment {
  children: CommentNode[];
}

function buildCommentTree(flat: SessionComment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  for (const c of flat) byId.set(c.id, { ...c, children: [] });
  const roots: CommentNode[] = [];
  for (const c of byId.values()) {
    if (c.parentCommentId && byId.has(c.parentCommentId)) {
      byId.get(c.parentCommentId)!.children.push(c);
    } else {
      roots.push(c);
    }
  }
  const sortByDate = (a: CommentNode, b: CommentNode) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  const walk = (nodes: CommentNode[]) => {
    nodes.sort(sortByDate);
    for (const n of nodes) walk(n.children);
  };
  walk(roots);
  return roots;
}

interface CommentItemProps {
  node: CommentNode;
  depth: number;
  onReply: (parentId: string, body: string) => void;
  pending: boolean;
}

function CommentItem({ node, depth, onReply, pending }: CommentItemProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState("");

  const submit = () => {
    const body = reply.trim();
    if (!body) return;
    onReply(node.id, body);
    setReply("");
    setReplyOpen(false);
  };

  return (
    <div
      className={depth > 0 ? "pl-4 border-l-2" : ""}
      style={depth > 0 ? { borderColor: "var(--boa-paper-3)" } : undefined}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center boa-mono text-[10px]"
          style={{ background: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
        >
          {userInitials({
            userDisplayName: node.userDisplayName,
            userEmail: node.userEmail,
          })}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-medium" style={{ color: "var(--boa-ink)" }}>
              {node.userDisplayName || node.userEmail || "Member"}
            </span>
            <span className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
              {new Date(node.createdAt).toLocaleString()}
            </span>
          </div>
          <div
            className="text-[13px] mt-0.5 whitespace-pre-wrap"
            style={{ color: "var(--boa-ink-2)" }}
          >
            {node.bodyText}
          </div>
          <button
            onClick={() => setReplyOpen((v) => !v)}
            className="mt-1 boa-mono text-[10px] uppercase tracking-[0.12em] inline-flex items-center gap-1 hover:underline"
            style={{ color: "var(--boa-ink-3)" }}
          >
            <CornerDownRight className="w-3 h-3" />
            Reply
          </button>
          {replyOpen && (
            <div className="mt-2 flex items-end gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={`Reply to ${node.userDisplayName || node.userEmail || "this comment"}…`}
                rows={2}
                className="flex-1 text-[13px] p-2 rounded-sm border bg-white focus:outline-none focus:ring-1"
                style={{ borderColor: "var(--boa-paper-3)" }}
              />
              <button
                onClick={submit}
                disabled={pending || !reply.trim()}
                className="boa-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1.5 rounded-sm flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: "var(--boa-ink)", color: "var(--boa-paper)" }}
              >
                <Send className="w-3 h-3" />
                Post
              </button>
            </div>
          )}
        </div>
      </div>
      {node.children.length > 0 && (
        <div className="mt-3 space-y-3 ml-3">
          {node.children.map((child) => (
            <CommentItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onReply={onReply}
              pending={pending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AnchorComments({ sessionId, anchorType, anchorId }: AnchorCollabProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const { data: comments } = useListSessionComments(sessionId, {
    query: {
      refetchInterval: 60_000,
      queryKey: ["/api/sessions", sessionId, "comments"],
    },
  });
  const create = useCreateSessionComment({
    mutation: {
      onSuccess: () => {
        setDraft("");
        qc.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "comments"] });
      },
    },
  });

  const filtered: SessionComment[] = (comments ?? []).filter(
    (c) => c.anchorType === anchorType && c.anchorId === anchorId,
  );

  const tree = useMemo(() => buildCommentTree(filtered), [filtered]);

  const submitTopLevel = () => {
    const body = draft.trim();
    if (!body) return;
    create.mutate({
      sessionId,
      data: { anchorType, anchorId, bodyText: body },
    });
  };

  const submitReply = (parentId: string, body: string) => {
    create.mutate({
      sessionId,
      data: { anchorType, anchorId, bodyText: body, parentCommentId: parentId },
    });
  };

  const total = filtered.length;

  return (
    <div className="mt-3 group/anchor relative">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="boa-mono text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-sm border flex items-center gap-1.5 hover:bg-[color:var(--boa-paper-2)] transition-colors"
          style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-3)" }}
        >
          <MessageSquare className="w-3 h-3" />
          {total > 0 ? `${total} comment${total > 1 ? "s" : ""}` : "Comment"}
        </button>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            aria-label="Add comment to this anchor"
            title="Add comment"
            className="opacity-0 group-hover/anchor:opacity-100 focus:opacity-100 transition-opacity boa-mono text-[10px] w-6 h-6 rounded-full border flex items-center justify-center hover:bg-[color:var(--boa-paper-2)]"
            style={{ borderColor: "var(--boa-brass)", color: "var(--boa-brass)" }}
          >
            <Plus className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && (
        <div
          className="mt-3 border-l-2 pl-4 max-w-2xl"
          style={{ borderColor: "var(--boa-brass)" }}
        >
          <div className="space-y-4 mb-3">
            {tree.length === 0 && (
              <div
                className="boa-mono text-[10px] uppercase tracking-[0.15em]"
                style={{ color: "var(--boa-ink-3)" }}
              >
                No comments yet — start the discussion.
              </div>
            )}
            {tree.map((root) => (
              <CommentItem
                key={root.id}
                node={root}
                depth={0}
                onReply={submitReply}
                pending={create.isPending}
              />
            ))}
          </div>

          <div className="flex items-end gap-2 pt-3 border-t boa-rule">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Leave a comment for the council…"
              rows={2}
              className="flex-1 text-[13px] p-2 rounded-sm border bg-white focus:outline-none focus:ring-1"
              style={{ borderColor: "var(--boa-paper-3)" }}
            />
            <button
              onClick={submitTopLevel}
              disabled={create.isPending || !draft.trim()}
              className="boa-mono text-[10px] uppercase tracking-[0.15em] px-3 py-2 rounded-sm flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: "var(--boa-ink)", color: "var(--boa-paper)" }}
            >
              <Send className="w-3 h-3" />
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface FollowUpRailProps {
  sessionId: string;
  canDispatch: boolean;
}

export function FollowUpRail({ sessionId, canDispatch }: FollowUpRailProps) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(true);

  const { data: proposals } = useListFollowUpProposals(sessionId, {
    query: {
      refetchInterval: 60_000,
      queryKey: ["/api/sessions", sessionId, "follow-ups"],
    },
  });
  const create = useCreateFollowUpProposal({
    mutation: {
      onSuccess: () => {
        setDraft("");
        qc.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "follow-ups"] });
      },
    },
  });
  const dispatch = useDispatchFollowUpProposal({
    mutation: {
      onSuccess: (resp) => {
        qc.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "follow-ups"] });
        if (resp?.session?.id) {
          window.location.href = `/sessions/${resp.session.id}`;
        }
      },
    },
  });

  const submit = () => {
    const q = draft.trim();
    if (!q) return;
    create.mutate({ sessionId, data: { questionText: q } });
  };

  const list: FollowUpProposal[] = proposals ?? [];

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 boa-mono text-[11px] uppercase tracking-[0.18em] px-3 py-2 rounded-sm border shadow-lg flex items-center gap-2"
        style={{
          background: "var(--boa-ink)",
          color: "var(--boa-paper)",
          borderColor: "var(--boa-brass)",
        }}
      >
        <GitBranch className="w-3.5 h-3.5" />
        Follow-ups ({list.length})
      </button>
    );
  }

  return (
    <aside
      className="fixed top-20 right-6 w-[320px] max-h-[calc(100dvh-7rem)] overflow-auto rounded-sm border shadow-xl z-20"
      style={{
        background: "var(--boa-paper)",
        borderColor: "var(--boa-paper-3)",
      }}
    >
      <div
        className="px-4 py-3 border-b boa-rule flex items-center justify-between sticky top-0"
        style={{ background: "var(--boa-paper)" }}
      >
        <div
          className="boa-mono text-[10px] uppercase tracking-[0.2em] flex items-center gap-2"
          style={{ color: "var(--boa-ink-2)" }}
        >
          <GitBranch className="w-3.5 h-3.5" style={{ color: "var(--boa-brass)" }} />
          Follow-up queue
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded-sm hover:bg-[color:var(--boa-paper-2)]"
          aria-label="Close follow-ups"
        >
          <X className="w-3.5 h-3.5" style={{ color: "var(--boa-ink-3)" }} />
        </button>
      </div>

      <div className="p-3 border-b boa-rule">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Propose a follow-up question for the master to ask…"
          rows={3}
          className="w-full text-[13px] p-2 rounded-sm border bg-white focus:outline-none"
          style={{ borderColor: "var(--boa-paper-3)" }}
        />
        <button
          onClick={submit}
          disabled={create.isPending || !draft.trim()}
          className="mt-2 w-full boa-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2 rounded-sm disabled:opacity-50"
          style={{ background: "var(--boa-ink)", color: "var(--boa-paper)" }}
        >
          Submit proposal
        </button>
      </div>

      <div className="p-3 space-y-3">
        {list.length === 0 && (
          <div
            className="boa-mono text-[10px] uppercase tracking-[0.15em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            No proposals yet.
          </div>
        )}
        {list.map((p) => (
          <div
            key={p.id}
            className="border boa-rule rounded-sm p-3"
            style={{ background: "rgba(245,241,234,0.5)" }}
          >
            <div
              className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-1"
              style={{ color: "var(--boa-ink-3)" }}
            >
              {p.userDisplayName || p.userEmail || "Member"} · {new Date(p.createdAt).toLocaleString()}
            </div>
            <div
              className="text-[13px] leading-relaxed mb-2 whitespace-pre-wrap"
              style={{ color: "var(--boa-ink)" }}
            >
              {p.questionText}
            </div>
            {p.status === "open" && canDispatch && (
              <button
                onClick={() => dispatch.mutate({ sessionId, proposalId: p.id })}
                disabled={dispatch.isPending}
                className="boa-mono text-[10px] uppercase tracking-[0.15em] px-2.5 py-1.5 rounded-sm flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: "var(--boa-brass)", color: "#1a1208" }}
              >
                <GitBranch className="w-3 h-3" />
                Branch this question
              </button>
            )}
            {p.status === "dispatched" && (
              <a
                href={p.dispatchedSessionId ? `/sessions/${p.dispatchedSessionId}` : "#"}
                className="boa-mono text-[10px] uppercase tracking-[0.15em] underline"
                style={{ color: "var(--boa-brass)" }}
              >
                Branched session →
              </a>
            )}
            {p.status === "open" && !canDispatch && (
              <div
                className="boa-mono text-[10px] uppercase tracking-[0.15em]"
                style={{ color: "var(--boa-ink-3)" }}
              >
                Awaiting an admin to dispatch.
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
