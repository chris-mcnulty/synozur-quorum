import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetBoard, useCreateSession, SessionMode } from "@workspace/api-client-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, Play, MessageSquare, Scale, CheckSquare } from "lucide-react";

export default function SessionRunner({
  tenantId,
  boardId,
}: {
  tenantId: string;
  boardId: string;
}) {
  const [, setLocation] = useLocation();
  const { data: boardDetail, isLoading } = useGetBoard(boardId);
  const createSession = useCreateSession();
  const { toast } = useToast();

  const [mode, setMode] = useState<SessionMode>(SessionMode.ADVISORY);
  const [questionText, setQuestionText] = useState("");
  const [allHands, setAllHands] = useState(false);

  const handleConvene = async () => {
    if (!questionText) return;
    try {
      const session = await createSession.mutateAsync({
        boardId,
        data: { mode, questionText, allHands },
      });
      setLocation(`/sessions/${session.id}`);
    } catch (err) {
      toast({
        title: "Error starting session",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (isLoading)
    return (
      <div className="max-w-[800px] mx-auto px-8 py-10">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--boa-brass)" }} />
      </div>
    );
  if (!boardDetail) return <div className="px-8 py-10">Board not found</div>;

  const modes: { id: SessionMode; label: string; desc: string; icon: any }[] = [
    {
      id: SessionMode.ADVISORY,
      label: "Advisory",
      desc: "Open exploration. No vote.",
      icon: MessageSquare,
    },
    {
      id: SessionMode.BOARD,
      label: "Board vote",
      desc: "Formal YES / NO / ABSTAIN with majority.",
      icon: Scale,
    },
    {
      id: SessionMode.REVIEW,
      label: "Review",
      desc: "Post-decision retrospective.",
      icon: CheckSquare,
    },
  ];

  return (
    <div className="max-w-[820px] mx-auto px-8 py-10">
      <Link
        href={`/t/${tenantId}/boards/${boardId}`}
        className="inline-flex items-center text-[12px] mb-6 boa-mono uppercase tracking-[0.15em] hover:underline"
        style={{ color: "var(--boa-ink-3)" }}
      >
        <ChevronLeft className="w-3.5 h-3.5 mr-1" />
        Back to board
      </Link>

      <header className="mb-10">
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.18em] mb-3"
          style={{ color: "var(--boa-brass)" }}
        >
          New session
        </div>
        <h1 className="boa-display text-[36px] leading-tight" style={{ color: "var(--boa-ink)" }}>
          Convene the {boardDetail.name}
        </h1>
        <p className="text-[14px] mt-2" style={{ color: "var(--boa-ink-3)" }}>
          {boardDetail.members.length} advisors seated · ready to deliberate.
        </p>
      </header>

      <section className="mb-10">
        <h2
          className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-4 pb-2 border-b boa-rule"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Mode
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          {modes.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className="text-left p-4 boa-surface rounded-sm transition-colors"
                style={{
                  borderColor: active ? "var(--boa-ink)" : "var(--boa-paper-3)",
                  background: active ? "#fffdf6" : "#fbf8f1",
                }}
              >
                <Icon
                  className="w-4 h-4 mb-3"
                  style={{ color: active ? "var(--boa-brass)" : "var(--boa-ink-3)" }}
                />
                <div className="boa-display text-[16px]" style={{ color: "var(--boa-ink)" }}>
                  {m.label}
                </div>
                <div
                  className="boa-mono text-[10px] uppercase tracking-wider mt-1"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  {m.desc}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mb-10">
        <h2
          className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-4 pb-2 border-b boa-rule"
          style={{ color: "var(--boa-ink-3)" }}
        >
          The question
        </h2>
        <Textarea
          className="min-h-[160px] text-[15px] resize-none"
          placeholder="State the core question, context, and any specific constraints…"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
        />
      </section>

      <section
        className="mb-10 flex items-center justify-between p-4 border rounded-sm"
        style={{ borderColor: "var(--boa-paper-3)", background: "var(--boa-paper-2)" }}
      >
        <div>
          <div className="text-[14px] font-medium" style={{ color: "var(--boa-ink)" }}>
            All-hands mode
          </div>
          <p className="text-[12px]" style={{ color: "var(--boa-ink-3)" }}>
            Force every advisor to participate regardless of relevance routing.
          </p>
        </div>
        <Switch checked={allHands} onCheckedChange={setAllHands} />
      </section>

      <div className="flex justify-end gap-3 pt-6 border-t boa-rule">
        <Link href={`/t/${tenantId}/boards/${boardId}`}>
          <button
            type="button"
            className="px-4 py-2 rounded-sm text-[13px] border"
            style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
          >
            Cancel
          </button>
        </Link>
        <button
          onClick={handleConvene}
          disabled={
            createSession.isPending || !questionText || boardDetail.members.length === 0
          }
          className="boa-cta-brass px-5 py-2.5 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
        >
          {createSession.isPending ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 mr-2" fill="currentColor" />
          )}
          Convene the council
        </button>
      </div>
    </div>
  );
}
