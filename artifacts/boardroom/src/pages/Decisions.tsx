import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  useListTenantDecisions,
  useRecordDecisionOutcome,
  useUpdateDecisionStatus,
  type Decision,
  type DecisionStatus,
  type OutcomeTag,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Loader2, Scale } from "lucide-react";

const STATUS_OPTIONS: DecisionStatus[] = [
  "PENDING",
  "ACTED",
  "DECLINED",
  "OVERRIDDEN",
];
const TAG_OPTIONS: OutcomeTag[] = ["WIN", "LOSS", "MIXED", "TOO_EARLY"];

const STATUS_COLORS: Record<DecisionStatus, string> = {
  PENDING: "var(--boa-ink-3)",
  ACTED: "var(--boa-vote-yes)",
  DECLINED: "var(--boa-vote-no)",
  OVERRIDDEN: "var(--boa-brass)",
};

const TAG_COLORS: Record<OutcomeTag, string> = {
  WIN: "var(--boa-vote-yes)",
  LOSS: "var(--boa-vote-no)",
  MIXED: "var(--boa-brass)",
  TOO_EARLY: "var(--boa-ink-3)",
};

export default function Decisions({ tenantId }: { tenantId: string }) {
  const [statusFilter, setStatusFilter] = useState<DecisionStatus | "ALL">(
    "ALL",
  );
  const [tagFilter, setTagFilter] = useState<OutcomeTag | "ALL">("ALL");
  const [drawer, setDrawer] = useState<Decision | null>(null);

  const { data, isLoading, refetch } = useListTenantDecisions(tenantId, {
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    ...(tagFilter !== "ALL" ? { tag: tagFilter } : {}),
  });

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-10">
      <header className="mb-8">
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.18em] mb-3"
          style={{ color: "var(--boa-brass)" }}
        >
          Decision ledger
        </div>
        <h1
          className="boa-display text-[36px] leading-tight"
          style={{ color: "var(--boa-ink)" }}
        >
          Decisions
        </h1>
        <p className="text-[14px] mt-2 max-w-2xl" style={{ color: "var(--boa-ink-2)" }}>
          Every voted session becomes a tracked decision. Record the outcome at
          30, 60, and 90 days to build institutional memory.
        </p>
      </header>

      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <FilterGroup
          label="Status"
          options={["ALL", ...STATUS_OPTIONS]}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as DecisionStatus | "ALL")}
        />
        <FilterGroup
          label="Outcome"
          options={["ALL", ...TAG_OPTIONS]}
          value={tagFilter}
          onChange={(v) => setTagFilter(v as OutcomeTag | "ALL")}
        />
      </div>

      {isLoading ? (
        <div className="py-10 flex items-center gap-2 text-[13px]" style={{ color: "var(--boa-ink-3)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Loading decisions…
        </div>
      ) : !data?.length ? (
        <div
          className="border boa-rule rounded-sm p-10 text-center"
          style={{ color: "var(--boa-ink-3)" }}
        >
          <Scale className="w-6 h-6 mx-auto mb-3 opacity-40" />
          <div className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2">
            No decisions match
          </div>
          <p className="text-[13px]">
            BOARD-mode sessions automatically create decisions here.
          </p>
        </div>
      ) : (
        <div className="border-t border-b boa-rule-strong divide-y boa-rule">
          {data.map((d) => (
            <DecisionRow
              key={d.id}
              decision={d}
              onRecord={() => setDrawer(d)}
            />
          ))}
        </div>
      )}

      <OutcomeDrawer
        decision={drawer}
        onClose={() => setDrawer(null)}
        onSaved={() => {
          setDrawer(null);
          refetch();
        }}
      />
    </div>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="boa-mono text-[10px] uppercase tracking-[0.15em]"
        style={{ color: "var(--boa-ink-3)" }}
      >
        {label}
      </span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const active = o === value;
          return (
            <button
              key={o}
              onClick={() => onChange(o)}
              className="boa-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors"
              style={{
                background: active ? "var(--boa-ink)" : "transparent",
                color: active ? "var(--boa-paper)" : "var(--boa-ink-2)",
                borderColor: active ? "var(--boa-ink)" : "var(--boa-paper-3)",
              }}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DecisionRow({
  decision: d,
  onRecord,
  showBoard = true,
}: {
  decision: Decision;
  onRecord: () => void;
  showBoard?: boolean;
}) {
  const total = d.voteYes + d.voteNo + d.voteAbstain;
  return (
    <div className="py-4 flex flex-wrap items-start gap-4">
      <div className="w-[80px] shrink-0 pt-1">
        <div
          className="boa-mono text-[10px] uppercase tracking-wider"
          style={{ color: "var(--boa-ink-3)" }}
        >
          {formatDistanceToNow(new Date(d.decidedAt), { addSuffix: true })}
        </div>
      </div>
      <div className="flex-1 min-w-[280px]">
        <Link
          href={`/sessions/${d.sessionId}`}
          className="boa-display text-[16px] italic block hover:underline"
          style={{ color: "var(--boa-ink)" }}
        >
          “{d.questionText}”
        </Link>
        {showBoard && d.boardName && (
          <div
            className="boa-mono text-[10px] uppercase tracking-wider mt-1"
            style={{ color: "var(--boa-ink-3)" }}
          >
            {d.boardName}
          </div>
        )}
        {d.recommendationText && (
          <div
            className="text-[13px] mt-2 line-clamp-2 max-w-2xl"
            style={{ color: "var(--boa-ink-2)" }}
          >
            {d.recommendationText}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 boa-mono text-[10px] pt-1">
        <Pip color="var(--boa-vote-yes)" label="Y" value={d.voteYes} total={total} />
        <Pip color="var(--boa-vote-no)" label="N" value={d.voteNo} total={total} />
        <Pip color="var(--boa-vote-abs)" label="A" value={d.voteAbstain} total={total} />
      </div>
      <div className="flex flex-col items-end gap-1.5 pt-1">
        <span
          className="boa-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm"
          style={{
            background: "rgba(20,20,26,0.04)",
            color: STATUS_COLORS[d.status as DecisionStatus] ?? "var(--boa-ink-2)",
          }}
        >
          {d.status}
        </span>
        {d.outcome ? (
          <span
            className="boa-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm"
            style={{
              background: TAG_COLORS[d.outcome.tag as OutcomeTag],
              color: "#fff",
            }}
          >
            {d.outcome.tag}
          </span>
        ) : (
          <button
            onClick={onRecord}
            className="boa-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm border hover:bg-[color:var(--boa-paper-2)]"
            style={{ borderColor: "var(--boa-ink)", color: "var(--boa-ink)" }}
          >
            Record outcome
          </button>
        )}
        {d.outcome && (
          <button
            onClick={onRecord}
            className="boa-mono text-[9px] uppercase tracking-wider hover:underline"
            style={{ color: "var(--boa-ink-3)" }}
          >
            Edit
          </button>
        )}
      </div>
    </div>
  );
}

function Pip({
  label,
  value,
  color,
  total,
}: {
  label: string;
  value: number;
  color: string;
  total: number;
}) {
  return (
    <span
      className="px-1.5 py-0.5 rounded-sm"
      style={{
        background: total > 0 && value > 0 ? color : "transparent",
        color: total > 0 && value > 0 ? "#fff" : "var(--boa-ink-3)",
        border: total > 0 && value > 0 ? "none" : "1px solid var(--boa-paper-3)",
      }}
    >
      {label}
      {value}
    </span>
  );
}

export function OutcomeDrawer({
  decision,
  onClose,
  onSaved,
}: {
  decision: Decision | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const recordOutcome = useRecordDecisionOutcome();
  const updateStatus = useUpdateDecisionStatus();
  const { toast } = useToast();
  const [tag, setTag] = useState<OutcomeTag>("WIN");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<DecisionStatus>("ACTED");

  // Sync state when decision changes
  useEffect(() => {
    if (decision?.outcome) {
      setTag(decision.outcome.tag as OutcomeTag);
      setNote(decision.outcome.noteText ?? "");
    } else {
      setTag("WIN");
      setNote("");
    }
    if (decision?.status) setStatus(decision.status as DecisionStatus);
  }, [decision?.id]);

  if (!decision) return null;

  const handleSave = async () => {
    try {
      await recordOutcome.mutateAsync({
        decisionId: decision.id,
        data: { tag, noteText: note || null, status },
      });
      toast({ title: "Outcome recorded" });
      onSaved();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleStatusOnly = async (next: DecisionStatus) => {
    try {
      await updateStatus.mutateAsync({
        decisionId: decision.id,
        data: { status: next },
      });
      toast({ title: `Marked ${next}` });
      onSaved();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={!!decision} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="boa-display text-[22px]">
            Record outcome
          </DialogTitle>
          <DialogDescription className="text-[13px] italic">
            “{decision.questionText}”
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div>
            <div
              className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-2"
              style={{ color: "var(--boa-ink-3)" }}
            >
              Decision status
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className="boa-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-sm border"
                  style={{
                    background: status === s ? "var(--boa-ink)" : "transparent",
                    color: status === s ? "var(--boa-paper)" : "var(--boa-ink-2)",
                    borderColor:
                      status === s ? "var(--boa-ink)" : "var(--boa-paper-3)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleStatusOnly("DECLINED")}
                className="boa-mono text-[10px] uppercase tracking-wider hover:underline"
                style={{ color: "var(--boa-ink-3)" }}
              >
                Mark declined without outcome
              </button>
            </div>
          </div>

          <div>
            <div
              className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-2"
              style={{ color: "var(--boa-ink-3)" }}
            >
              Outcome tag
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TAG_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(t)}
                  className="boa-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 rounded-sm border"
                  style={{
                    background:
                      tag === t ? TAG_COLORS[t] : "transparent",
                    color: tag === t ? "#fff" : "var(--boa-ink-2)",
                    borderColor:
                      tag === t ? TAG_COLORS[t] : "var(--boa-paper-3)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div
              className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-2"
              style={{ color: "var(--boa-ink-3)" }}
            >
              Note
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What actually happened? What did the council miss or get right?"
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-sm text-[13px] border"
            style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={recordOutcome.isPending}
            className="boa-cta-brass px-4 py-2 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
          >
            {recordOutcome.isPending && (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            )}
            Save outcome
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
