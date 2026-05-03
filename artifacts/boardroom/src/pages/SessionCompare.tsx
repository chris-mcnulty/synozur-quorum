import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Check, ChevronLeft, Copy, GitBranch, Loader2, Share2 } from "lucide-react";
import {
  useCompareSessions,
  useCreateCompareShareLink,
  useGetPublicCompareShare,
  type SessionCompareResult,
  type Vote,
} from "@workspace/api-client-react";

function useQuerySessionIds(): string[] {
  const [location] = useLocation();
  return useMemo(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(search);
    const raw = params.get("ids") ?? "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
  }, [location]);
}

const voteColor = (v?: Vote | null) =>
  v === "YES"
    ? "var(--boa-vote-yes)"
    : v === "NO"
    ? "var(--boa-vote-no)"
    : "var(--boa-vote-abs)";

export default function SessionCompare({
  shareToken,
}: { shareToken?: string } = {}) {
  const ids = useQuerySessionIds();
  const isPublic = Boolean(shareToken);
  const [data, setData] = useState<SessionCompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const compareMutation = useCompareSessions({
    mutation: {
      onSuccess: (d) => setData(d),
      onError: (err: unknown) => {
        const e = err as { message?: string };
        setError(e?.message ?? "Failed to load comparison");
      },
    },
  });

  // Public token-based fetch (used when rendering /share/compare/:token)
  const publicQuery = useGetPublicCompareShare(shareToken ?? "", {
    query: { enabled: isPublic && Boolean(shareToken), retry: false },
  });
  useEffect(() => {
    if (!isPublic) return;
    if (publicQuery.data) setData(publicQuery.data);
    if (publicQuery.error) {
      const e = publicQuery.error as { message?: string };
      setError(e?.message ?? "Share link is invalid or has been revoked.");
    }
  }, [isPublic, publicQuery.data, publicQuery.error]);

  useEffect(() => {
    if (isPublic) return;
    if (ids.length < 2) return;
    setError(null);
    setData(null);
    compareMutation.mutate({ data: { sessionIds: ids } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(","), isPublic]);

  if (!isPublic && ids.length < 2) {
    return (
      <div className="max-w-[1200px] mx-auto px-8 py-12">
        <p>Provide at least two session IDs in the <code>?ids=</code> query parameter.</p>
      </div>
    );
  }

  const isLoading = isPublic
    ? publicQuery.isLoading || (!data && !error)
    : compareMutation.isPending || !data;

  if (error && !data) {
    return (
      <div className="max-w-[1200px] mx-auto px-8 py-12">
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.2em] mb-2"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Compare unavailable
        </div>
        <p className="text-[14px]" style={{ color: "var(--boa-ink-2)" }} data-testid="text-share-error">
          {error}
        </p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="max-w-[1200px] mx-auto px-8 py-12 flex items-center gap-3">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--boa-brass)" }} />
        <span className="boa-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--boa-ink-3)" }}>
          Synthesizing what changed in the council's reasoning…
        </span>
      </div>
    );
  }

  const labels = data.entries.map((_, i) => String.fromCharCode(65 + i));

  // For each rewound (pivot) session, locate the member whose voice was
  // re-run and remember the (sessionIndex, memberKey) cell so we can highlight
  // exactly that aligned cell in the matrix below — not the entire row.
  const rewoundCells = new Set<string>(); // `${sessionIndex}|${memberKey}`
  data.entries.forEach((e, i) => {
    if (!e.session.pivotContributionId) return;
    for (const other of data.entries) {
      const pivot = other.contributions.find(
        (c) => c.id === e.session.pivotContributionId,
      );
      if (pivot) {
        const key = `${(pivot.memberRoleTitle ?? "").toLowerCase()}|${(pivot.memberName ?? "").toLowerCase()}`;
        rewoundCells.add(`${i}|${key}`);
        break;
      }
    }
  });

  // Highlight question diffs by word-level diff (simple heuristic: shared vs new tokens)
  const baselineWords = new Set(
    data.entries[0]?.session.questionText.toLowerCase().split(/\s+/).filter(Boolean) ?? [],
  );

  const compareIds = isPublic
    ? data.entries.map((e) => e.session.id)
    : ids;

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-12 pb-32">
      <div className="flex items-center justify-between mb-6">
        {isPublic ? (
          <div
            className="boa-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Quorum · Public share
          </div>
        ) : (
          <Link
            href={`/sessions/${ids[0]}`}
            className="inline-flex items-center text-[12px] boa-mono uppercase tracking-[0.15em] hover:underline"
            style={{ color: "var(--boa-ink-3)" }}
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Back to session
          </Link>
        )}
        <div className="flex items-center gap-4">
          <div
            className="boa-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Compare · {data.entries.length} sessions
          </div>
          {!isPublic && <ShareCompareButton sessionIds={compareIds} />}
        </div>
      </div>

      {/* Master delta */}
      <section className="mb-10 border boa-rule-strong rounded-sm p-6" style={{ background: "rgba(184,134,11,0.06)" }}>
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.2em] font-bold mb-4 flex items-center gap-2"
          style={{ color: "var(--boa-brass)" }}
        >
          <GitBranch className="w-3.5 h-3.5" />
          What changed in the council's reasoning
        </div>
        <div
          className="text-[15px] leading-relaxed whitespace-pre-wrap"
          style={{ color: "var(--boa-ink)" }}
          data-testid="text-delta-note"
        >
          {data.deltaNote}
        </div>
      </section>

      {/* Question diffs */}
      <SectionTitle>Question diff</SectionTitle>
      <div
        className="grid gap-3 mb-10"
        style={{ gridTemplateColumns: `repeat(${data.entries.length}, minmax(0, 1fr))` }}
      >
        {data.entries.map((e, i) => {
          const tokens = e.session.questionText.split(/(\s+)/);
          return (
            <div key={e.session.id} className="border boa-rule rounded-sm p-4" style={{ background: "var(--boa-paper)" }}>
              <div
                className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2 flex items-center justify-between"
                style={{ color: "var(--boa-ink-3)" }}
              >
                <span>Session {labels[i]} · {e.boardName}</span>
                <span style={{ color: voteColor(null) }}>{e.session.status}</span>
              </div>
              <div className="text-[14px] italic leading-snug" style={{ color: "var(--boa-ink)" }}>
                “
                {tokens.map((t, ti) => {
                  if (i === 0) return <span key={ti}>{t}</span>;
                  const lower = t.toLowerCase();
                  const isWord = /\S/.test(t);
                  const isNew = isWord && !baselineWords.has(lower);
                  return (
                    <span
                      key={ti}
                      style={
                        isNew
                          ? { background: "rgba(184,134,11,0.2)", color: "var(--boa-ink)" }
                          : undefined
                      }
                    >
                      {t}
                    </span>
                  );
                })}
                ”
              </div>
              {e.session.branchNote && (
                <div
                  className="mt-2 boa-mono text-[10px] uppercase tracking-[0.15em]"
                  style={{ color: "var(--boa-brass)" }}
                >
                  Δ {e.session.branchNote}
                </div>
              )}
              <Link
                href={`/sessions/${e.session.id}`}
                className="boa-mono text-[10px] uppercase tracking-[0.15em] hover:underline mt-3 inline-block"
                style={{ color: "var(--boa-ink-3)" }}
              >
                Open full minutes →
              </Link>
            </div>
          );
        })}
      </div>

      {/* Aligned-by-advisor contributions */}
      <SectionTitle>Contributions per advisor</SectionTitle>
      <div className="space-y-6 mb-10">
        {data.memberAlignments.map((row) => {
          return (
          <div key={row.memberKey} className="border boa-rule rounded-sm">
            <div
              className="px-4 py-2 border-b boa-rule"
              style={{ background: "var(--boa-paper-2)" }}
            >
              <div className="boa-display text-[16px]" style={{ color: "var(--boa-ink)" }}>
                {row.memberName}{" "}
                <span className="text-[12px] italic font-normal" style={{ color: "var(--boa-ink-3)" }}>
                  — {row.memberRoleTitle}
                </span>
              </div>
            </div>
            <div
              className="grid divide-x boa-rule"
              style={{ gridTemplateColumns: `repeat(${data.entries.length}, minmax(0, 1fr))` }}
            >
              {row.perSession.map((c, i) => {
                const isRewoundCell = rewoundCells.has(`${i}|${row.memberKey}`);
                return (
                <div
                  key={i}
                  className="p-4"
                  data-testid={`cell-alignment-${i}-${row.memberKey}`}
                  style={
                    isRewoundCell
                      ? {
                          background: "rgba(184,134,11,0.08)",
                          boxShadow: "inset 0 0 0 2px var(--boa-brass)",
                        }
                      : undefined
                  }
                >
                  <div
                    className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2 flex items-center justify-between gap-2"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    <span className="flex items-center gap-1.5">
                      Session {labels[i]}
                      {isRewoundCell && (
                        <span
                          className="px-1.5 py-0.5 rounded-sm font-bold flex items-center gap-1"
                          style={{ background: "var(--boa-brass)", color: "#fff" }}
                          data-testid={`pill-rewound-cell-${i}-${row.memberKey}`}
                          title="This advisor's voice was re-run in this rewound session"
                        >
                          <GitBranch className="w-2.5 h-2.5" />
                          Rewound
                        </span>
                      )}
                    </span>
                    {c?.vote && (
                      <span
                        className="px-1.5 py-0.5 rounded-sm font-bold"
                        style={{ background: voteColor(c.vote), color: "#fff" }}
                      >
                        {c.vote}
                      </span>
                    )}
                  </div>
                  {c ? (
                    <div
                      className="text-[13px] leading-relaxed whitespace-pre-wrap"
                      style={{
                        color: isRewoundCell ? "var(--boa-ink)" : "var(--boa-ink-2)",
                        fontWeight: isRewoundCell ? 500 : undefined,
                      }}
                    >
                      {(c.contributionText ?? "").slice(0, 1200)}
                      {(c.contributionText?.length ?? 0) > 1200 ? "…" : ""}
                    </div>
                  ) : (
                    <div className="text-[12px] italic" style={{ color: "var(--boa-ink-3)" }}>
                      Not routed in this session.
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
          );
        })}
        {data.memberAlignments.length === 0 && (
          <div className="text-[13px]" style={{ color: "var(--boa-ink-3)" }}>
            No contributions to align yet.
          </div>
        )}
      </div>

      {/* Vote tallies */}
      <SectionTitle>Vote tallies</SectionTitle>
      <div
        className="grid gap-3 mb-10"
        style={{ gridTemplateColumns: `repeat(${data.entries.length}, minmax(0, 1fr))` }}
      >
        {data.entries.map((e, i) => {
          const yes = e.contributions.filter((c) => c.vote === "YES").length;
          const no = e.contributions.filter((c) => c.vote === "NO").length;
          const abs = e.contributions.filter((c) => c.vote === "ABSTAIN").length;
          return (
            <div key={e.session.id} className="border boa-rule rounded-sm p-4">
              <div className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-3" style={{ color: "var(--boa-ink-3)" }}>
                Session {labels[i]}
              </div>
              <div className="grid grid-cols-3 text-center">
                <Tally label="Yes" value={yes} color="var(--boa-vote-yes)" />
                <Tally label="No" value={no} color="var(--boa-vote-no)" />
                <Tally label="Abs" value={abs} color="var(--boa-vote-abs)" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-4 pb-2 border-b boa-rule"
      style={{ color: "var(--boa-ink-3)" }}
    >
      {children}
    </h2>
  );
}

function ShareCompareButton({ sessionIds }: { sessionIds: string[] }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const create = useCreateCompareShareLink({
    mutation: {
      onSuccess: (link) => {
        setShareUrl(link.url);
        setErrorMsg(null);
      },
      onError: (err: unknown) => {
        const e = err as { message?: string };
        setErrorMsg(e?.message ?? "Failed to create share link");
      },
    },
  });

  const onShare = () => {
    setCopied(false);
    setErrorMsg(null);
    create.mutate({ data: { sessionIds } });
  };

  const onCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore — user can select manually
    }
  };

  return (
    <div className="flex items-center gap-2">
      {shareUrl ? (
        <div
          className="flex items-center gap-2 border boa-rule rounded-sm px-2 py-1"
          style={{ background: "var(--boa-paper-2)" }}
        >
          <input
            data-testid="input-share-url"
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="boa-mono text-[10px] bg-transparent outline-none w-[280px]"
            style={{ color: "var(--boa-ink-2)" }}
          />
          <button
            type="button"
            data-testid="button-copy-share-url"
            onClick={onCopy}
            className="boa-mono text-[10px] uppercase tracking-[0.15em] inline-flex items-center gap-1 hover:underline"
            style={{ color: "var(--boa-brass)" }}
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" /> Copy
              </>
            )}
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid="button-share-compare"
          onClick={onShare}
          disabled={create.isPending || sessionIds.length < 2}
          className="boa-mono text-[10px] uppercase tracking-[0.18em] inline-flex items-center gap-1.5 px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors disabled:opacity-50"
          style={{ borderColor: "var(--boa-ink)", color: "var(--boa-ink)" }}
        >
          {create.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Share2 className="w-3 h-3" />
          )}
          Share
        </button>
      )}
      {errorMsg && (
        <span
          className="boa-mono text-[10px]"
          style={{ color: "var(--boa-vote-no)" }}
          data-testid="text-share-create-error"
        >
          {errorMsg}
        </span>
      )}
    </div>
  );
}

function Tally({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="boa-display boa-num text-[24px] leading-none" style={{ color }}>
        {value}
      </div>
      <div className="boa-mono text-[9px] uppercase tracking-wider mt-1" style={{ color: "var(--boa-ink-3)" }}>
        {label}
      </div>
    </div>
  );
}
