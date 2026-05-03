import { useState } from "react";
import {
  useGetSessionAudio,
  useEstimateSessionAudio,
  useGenerateSessionAudio,
  useDeleteSessionAudio,
  getGetSessionAudioQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mic } from "lucide-react";
import { AudioPlayer } from "./AudioPlayer";

export function AudioBriefingPanel({ sessionId }: { sessionId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const audioQ = useGetSessionAudio(sessionId, {
    query: { retry: false },
  });
  const estimateQ = useEstimateSessionAudio(sessionId);
  const generate = useGenerateSessionAudio();
  const del = useDeleteSessionAudio();
  const [confirming, setConfirming] = useState(false);

  const audio = audioQ.data;
  const audioMissing = audioQ.error && (audioQ.error as { status?: number }).status === 404;

  const handleGenerate = async () => {
    setConfirming(false);
    try {
      await generate.mutateAsync({ sessionId });
      await qc.invalidateQueries({ queryKey: getGetSessionAudioQueryKey(sessionId) });
      audioQ.refetch();
      toast({ title: "Audio briefing ready" });
    } catch (err) {
      const e = err as { message?: string; status?: number };
      toast({
        title: "Generation failed",
        description: e.message || "Could not synthesize audio.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this audio briefing?")) return;
    try {
      await del.mutateAsync({ sessionId });
      audioQ.refetch();
      toast({ title: "Audio deleted" });
    } catch (err) {
      const e = err as { message?: string };
      toast({
        title: "Delete failed",
        description: e.message,
        variant: "destructive",
      });
    }
  };

  // Loading state
  if (audioQ.isLoading) {
    return (
      <div
        className="border boa-rule rounded-sm p-5 boa-mono text-[11px] uppercase tracking-[0.15em] flex items-center gap-2"
        style={{ background: "rgba(245,241,234,0.5)", color: "var(--boa-ink-3)" }}
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Loading audio…
      </div>
    );
  }

  // Audio exists - show player
  if (audio && !audioMissing) {
    return (
      <AudioPlayer
        audioUrl={audio.audioUrl}
        durationSeconds={audio.durationSeconds}
        sections={audio.sections}
        voicesUsed={audio.voicesUsed}
        bytes={audio.bytes}
        onDelete={handleDelete}
      />
    );
  }

  // Audio missing - show generate UI
  const est = estimateQ.data;
  const enabled = est?.enabled ?? false;

  if (!enabled) {
    return (
      <div
        className="border boa-rule rounded-sm p-5"
        style={{ background: "rgba(245,241,234,0.5)" }}
      >
        <div className="flex items-center gap-3">
          <Mic className="w-4 h-4" style={{ color: "var(--boa-ink-3)" }} />
          <div>
            <div
              className="boa-mono text-[11px] uppercase tracking-[0.15em] mb-1"
              style={{ color: "var(--boa-ink-2)" }}
            >
              Audio briefing
            </div>
            <div className="text-[13px]" style={{ color: "var(--boa-ink-3)" }}>
              Audio mode is disabled for this tenant. Owners can enable it under
              Tenant Admin → Audio briefings.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="border boa-rule rounded-sm p-5"
      style={{ background: "rgba(245,241,234,0.5)" }}
    >
      <div className="flex items-start gap-4 flex-wrap">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "var(--boa-ink)", color: "var(--boa-paper)" }}
        >
          <Mic className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-[260px]">
          <div className="boa-display text-[18px]" style={{ color: "var(--boa-ink)" }}>
            Generate audio briefing
          </div>
          <div className="text-[13px] mt-1" style={{ color: "var(--boa-ink-2)" }}>
            A 3–7 minute narrated podcast of these minutes — Chair, primary advisor,
            and dissenter, in distinct voices.
          </div>
          {est && (
            <div
              className="mt-3 boa-mono text-[10px] uppercase tracking-[0.15em] flex flex-wrap gap-x-5 gap-y-1"
              style={{ color: "var(--boa-ink-3)" }}
            >
              <span>~{Math.round(est.estimatedSeconds / 60)} min</span>
              <span>{est.voiceCount} voices</span>
              <span>{est.lineCount} lines</span>
              <span style={{ color: "var(--boa-brass)" }}>
                Est. ${(est.estimatedCostCents / 100).toFixed(3)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={generate.isPending || !est}
              className="boa-cta-brass px-4 py-2.5 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
            >
              <Mic className="w-3.5 h-3.5 mr-2" />
              Generate audio
            </button>
          ) : (
            <>
              <button
                onClick={handleGenerate}
                disabled={generate.isPending}
                className="boa-cta-brass px-4 py-2.5 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
              >
                {generate.isPending && (
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                )}
                Confirm · ${((est?.estimatedCostCents ?? 0) / 100).toFixed(3)}
              </button>
              <button
                onClick={() => setConfirming(false)}
                disabled={generate.isPending}
                className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm"
                style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
      {generate.isPending && (
        <div
          className="mt-4 boa-mono text-[11px] uppercase tracking-[0.15em] flex items-center gap-2"
          style={{ color: "var(--boa-brass)" }}
        >
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Synthesizing voices… This can take 30–90 seconds.
        </div>
      )}
    </div>
  );
}
