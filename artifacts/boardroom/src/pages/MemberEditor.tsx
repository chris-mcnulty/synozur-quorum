import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  useListBoardMembers,
  useUpdateBoardMember,
  useRegisterGroundingDocument,
  useGetBoardIntelligence,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, Save, FileText, AlertTriangle, Sliders, Trophy } from "lucide-react";
import { ObjectUploader } from "@workspace/object-storage-web";
import { GroundingSelectorList } from "@/components/GroundingSelectorList";

export default function MemberEditor({
  tenantId,
  boardId,
  memberId,
}: {
  tenantId: string;
  boardId: string;
  memberId: string;
}) {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const isRetune = useMemo(() => new URLSearchParams(search).get("retune") === "1", [search]);
  const { data: members, isLoading } = useListBoardMembers(boardId);
  const { data: intel } = useGetBoardIntelligence(boardId);
  const updateMember = useUpdateBoardMember();
  const registerDocument = useRegisterGroundingDocument();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    roleTitle: "",
    lensDescription: "",
    instructionsText: "",
    modelOverride: "",
  });

  const member = members?.find((m) => m.id === memberId);
  const trackRecord = intel?.perAdvisor.find((a) => a.memberId === memberId)
    ?.trackRecord;
  const resolvedDecisionCount = intel?.resolvedDecisionCount ?? 0;

  useEffect(() => {
    if (member)
      setFormData({
        name: member.name || "",
        roleTitle: member.roleTitle || "",
        lensDescription: member.lensDescription || "",
        instructionsText: member.instructionsText || "",
        modelOverride: member.modelOverride || "",
      });
  }, [member]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMember.mutateAsync({
        memberId,
        data: {
          name: formData.name,
          roleTitle: formData.roleTitle,
          lensDescription: formData.lensDescription || undefined,
          instructionsText: formData.instructionsText || undefined,
          modelOverride: formData.modelOverride || undefined,
        },
      });
      setLocation(`/t/${tenantId}/boards/${boardId}`);
    } catch (err) {
      toast({
        title: "Error saving advisor",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleGetUploadParameters = async (file: any) => {
    const res = await fetch(`/api/storage/uploads/request-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      }),
    });
    const data = await res.json();
    (file as any).replitObjectPath = data.objectPath;
    return {
      method: "PUT" as const,
      url: data.uploadURL,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    };
  };

  const handleUploadComplete = async (result: any) => {
    if (result.successful?.length > 0) {
      const file = result.successful[0];
      const objectPath = file.replitObjectPath;
      try {
        const doc = await registerDocument.mutateAsync({
          data: {
            tenantId,
            objectPath,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          },
        });
        await updateMember.mutateAsync({
          memberId,
          data: { groundingDocumentId: doc.id },
        });
        toast({ title: "Document attached" });
      } catch (err) {
        toast({
          title: "Error attaching document",
          description: err instanceof Error ? err.message : "Failed",
          variant: "destructive",
        });
      }
    }
  };

  if (isLoading)
    return (
      <div className="max-w-[800px] mx-auto px-8 py-10">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--boa-brass)" }} />
      </div>
    );
  if (!member) return <div className="px-8 py-10">Advisor not found</div>;

  const doc = member.groundingDocument;

  return (
    <div className="max-w-[800px] mx-auto px-8 py-10 pb-32">
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
          {isRetune ? "Retune advisor" : "Edit advisor"}
        </div>
        <h1 className="boa-display text-[36px] leading-tight" style={{ color: "var(--boa-ink)" }}>
          {member.name}
        </h1>
      </header>
      {isRetune && (
        <div
          className="mb-8 flex items-start gap-3 p-4 border rounded-sm"
          style={{
            background: "rgba(196,106,42,0.08)",
            borderColor: "rgba(196,106,42,0.3)",
          }}
          data-testid="retune-banner"
        >
          <Sliders className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--boa-brass)" }} />
          <div className="text-[13px]" style={{ color: "var(--boa-ink-2)" }}>
            <div className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: "var(--boa-brass)" }}>
              Anomalous pattern detected
            </div>
            This advisor's vote alignment with the council majority is unusually
            low. Review their lens, instructions, and model below — consider
            tightening the lens or swapping the model so they bring a clearer
            point of view.
          </div>
        </div>
      )}

      <Section title="Track record" hint={`${resolvedDecisionCount} resolved decisions on this board`}>
        {trackRecord && trackRecord.scored > 0 ? (
          <div
            className="grid grid-cols-4 border-y boa-rule"
            data-testid="member-track-record"
          >
            <TrackStat label="Wins" value={trackRecord.wins} tone="positive" />
            <TrackStat label="Losses" value={trackRecord.losses} tone="negative" />
            <TrackStat label="Mixed" value={trackRecord.mixed} />
            <TrackStat
              label="Score"
              value={`${trackRecord.score >= 0 ? "+" : ""}${Math.round(
                trackRecord.score * 100,
              )}`}
              tone={
                trackRecord.score > 0.2
                  ? "positive"
                  : trackRecord.score < -0.2
                  ? "negative"
                  : "neutral"
              }
              icon={
                trackRecord.score > 0.2 ? (
                  <Trophy className="w-3 h-3" />
                ) : null
              }
            />
          </div>
        ) : (
          <div
            className="boa-mono text-[10px] uppercase tracking-[0.18em] py-3"
            style={{ color: "var(--boa-ink-3)" }}
            data-testid="member-track-record-empty"
          >
            {resolvedDecisionCount === 0
              ? "No decisions on this board have a recorded outcome yet."
              : "This advisor has not voted YES/NO on any resolved decisions yet."}
          </div>
        )}
        <p className="text-[12px]" style={{ color: "var(--boa-ink-2)" }}>
          Track record only counts decisions whose outcome has been tagged
          (WIN/LOSS/MIXED). A win = this advisor voted YES on a WIN, or NO on
          a LOSS. Abstentions and TOO_EARLY tags are ignored.
        </p>
      </Section>

      <form onSubmit={handleSave} className="space-y-10">
        <Section title="Identity">
          <div className="grid md:grid-cols-2 gap-6">
            <Field label="Name">
              <Input
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </Field>
            <Field label="Role / title">
              <Input
                value={formData.roleTitle}
                onChange={(e) => setFormData((p) => ({ ...p, roleTitle: e.target.value }))}
                placeholder="Capital Allocator"
                required
              />
            </Field>
          </div>
          <Field label="Lens" hint="A one-line description of what this advisor cares about most">
            <Input
              value={formData.lensDescription}
              onChange={(e) => setFormData((p) => ({ ...p, lensDescription: e.target.value }))}
              placeholder="Evaluates decisions through asymmetric upside and capital efficiency."
            />
          </Field>
        </Section>

        <Section title="Instructions" hint={`${formData.instructionsText.length} chars`}>
          <Textarea
            className="min-h-[300px] boa-mono text-[12.5px]"
            value={formData.instructionsText}
            onChange={(e) => setFormData((p) => ({ ...p, instructionsText: e.target.value }))}
            placeholder="You are the Capital Allocator. You speak with quiet authority…"
          />
        </Section>

        <Section title="Grounding document">
          {doc ? (
            <div
              className="flex items-center justify-between p-4 border rounded-sm"
              style={{ borderColor: "var(--boa-paper-3)", background: "var(--boa-paper-2)" }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-sm flex items-center justify-center"
                  style={{ background: "var(--boa-brass-tint)", color: "var(--boa-brass)" }}
                >
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: "var(--boa-ink)" }}>
                    {doc.filename}
                  </p>
                  <p className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
                    {Math.round(doc.characterCount).toLocaleString()} chars
                    {doc.truncated && " · truncated"}
                  </p>
                </div>
              </div>
              <ObjectUploader
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                buttonClassName="boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper)] transition-colors"
              >
                Replace
              </ObjectUploader>
            </div>
          ) : (
            <div
              className="flex justify-center border border-dashed rounded-sm p-8"
              style={{ borderColor: "var(--boa-ink-3)" }}
            >
              <ObjectUploader
                onGetUploadParameters={handleGetUploadParameters}
                onComplete={handleUploadComplete}
                buttonClassName="boa-cta px-4 py-2 rounded-sm text-[13px] font-medium"
              >
                Upload document
              </ObjectUploader>
            </div>
          )}

          {doc?.truncated && (
            <div
              className="mt-3 flex items-start gap-2 p-3 rounded-sm border text-[12px]"
              style={{
                background: "rgba(196,106,42,0.08)",
                borderColor: "rgba(196,106,42,0.3)",
                color: "var(--boa-flag)",
              }}
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p>This document was truncated to fit within context. The advisor sees only the beginning.</p>
            </div>
          )}
        </Section>

        <Section title="Live grounding selectors" hint="Advisor-scoped">
          <p className="text-[12.5px]" style={{ color: "var(--boa-ink-2)" }}>
            These selectors fetch only when this advisor speaks. Use them when
            one advisor needs context the rest of the council doesn't.
          </p>
          <GroundingSelectorList
            tenantId={tenantId}
            scope={{ boardMemberId: memberId }}
          />
        </Section>

        <Section title="Advanced">
          <Field label="Model override" hint="Leave blank for board default (claude-sonnet-4-6)">
            <Input
              value={formData.modelOverride}
              onChange={(e) => setFormData((p) => ({ ...p, modelOverride: e.target.value }))}
              placeholder="claude-sonnet-4-6"
              className="boa-mono text-[12.5px]"
            />
          </Field>
        </Section>

        <div
          className="sticky bottom-4 flex justify-end gap-3 pt-4 border-t boa-rule"
          style={{ background: "var(--boa-paper)" }}
        >
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
            type="submit"
            disabled={updateMember.isPending}
            className="boa-cta px-5 py-2 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
          >
            {updateMember.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-2" />
            )}
            Save advisor
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between border-b boa-rule pb-2">
        <h2
          className="boa-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          {title}
        </h2>
        {hint && (
          <span className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
            {hint}
          </span>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function TrackStat({
  label,
  value,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: number | string;
  tone?: "neutral" | "positive" | "negative";
  icon?: React.ReactNode;
}) {
  const color =
    tone === "positive"
      ? "var(--boa-vote-yes)"
      : tone === "negative"
      ? "var(--boa-vote-no)"
      : "var(--boa-ink)";
  return (
    <div className="px-4 py-4 border-r last:border-r-0 boa-rule">
      <div
        className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-2"
        style={{ color: "var(--boa-ink-3)" }}
      >
        {label}
      </div>
      <div
        className="boa-display boa-num text-[24px] leading-none inline-flex items-center gap-1.5"
        style={{ color }}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        className="boa-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: "var(--boa-ink-3)" }}
      >
        {label}
      </Label>
      {children}
      {hint && (
        <p className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
