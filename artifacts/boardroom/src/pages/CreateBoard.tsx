import { useState } from "react";
import { useLocation, Link } from "wouter";
import {
  useCreateBoard,
  useListBoardTemplates,
  useSeatBoardTemplate,
} from "@workspace/api-client-react";
import type { BoardTemplate } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, Check, Users } from "lucide-react";

export default function CreateBoard({ tenantId }: { tenantId: string }) {
  const [, setLocation] = useLocation();
  const createBoard = useCreateBoard();
  const seatTemplate = useSeatBoardTemplate();
  const { data: templates } = useListBoardTemplates();
  const { toast } = useToast();

  const [selectedTemplate, setSelectedTemplate] = useState<BoardTemplate | null>(
    null,
  );

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    topicArea: "",
    size: "5",
    masterInstructionsText: "",
  });

  const applyTemplate = (t: BoardTemplate | null) => {
    setSelectedTemplate(t);
    if (t) {
      setFormData((p) => ({
        ...p,
        name: p.name || t.name,
        topicArea: p.topicArea || t.topicArea,
        description: p.description || t.description,
        size: String(t.size),
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    try {
      const board = await createBoard.mutateAsync({
        tenantId,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          topicArea: formData.topicArea || undefined,
          size: parseInt(formData.size) as any,
          masterInstructionsText: formData.masterInstructionsText || undefined,
        },
      });
      if (selectedTemplate) {
        try {
          await seatTemplate.mutateAsync({
            boardId: board.id,
            data: { templateSlug: selectedTemplate.slug },
          });
        } catch (err) {
          toast({
            title: "Board created, but template seating failed",
            description: err instanceof Error ? err.message : "Unknown error",
            variant: "destructive",
          });
        }
      }
      setLocation(`/t/${tenantId}/boards/${board.id}`);
    } catch (err) {
      toast({
        title: "Error creating board",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const submitting = createBoard.isPending || seatTemplate.isPending;

  return (
    <div className="max-w-[920px] mx-auto px-8 py-10">
      <Link
        href={`/t/${tenantId}/boards`}
        className="inline-flex items-center text-[12px] mb-6 boa-mono uppercase tracking-[0.15em] hover:underline"
        style={{ color: "var(--boa-ink-3)" }}
      >
        <ChevronLeft className="w-3.5 h-3.5 mr-1" />
        Back to boards
      </Link>

      <header className="mb-10">
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.18em] mb-3"
          style={{ color: "var(--boa-brass)" }}
        >
          New board
        </div>
        <h1 className="boa-display text-[36px] leading-tight" style={{ color: "var(--boa-ink)" }}>
          Convene a new council
        </h1>
        <p className="text-[14px] mt-2" style={{ color: "var(--boa-ink-3)" }}>
          Define purpose, topic, and the master framing that will guide every session.
        </p>
      </header>

      {/* Template wizard */}
      {templates && templates.length > 0 && (
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4 border-b boa-rule pb-2">
            <h2
              className="boa-mono text-[10px] uppercase tracking-[0.2em]"
              style={{ color: "var(--boa-ink-3)" }}
            >
              Start from a template (optional)
            </h2>
            {selectedTemplate && (
              <button
                type="button"
                onClick={() => setSelectedTemplate(null)}
                className="boa-mono text-[10px] uppercase tracking-[0.18em] hover:underline"
                style={{ color: "var(--boa-ink-3) " }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {templates.map((t) => {
              const isSelected = selectedTemplate?.slug === t.slug;
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => applyTemplate(isSelected ? null : t)}
                  data-testid={`template-${t.slug}`}
                  className="text-left p-4 border rounded-sm transition-colors"
                  style={{
                    borderColor: isSelected
                      ? "var(--boa-brass)"
                      : "var(--boa-paper-3)",
                    background: isSelected
                      ? "var(--boa-brass-tint, rgba(196,142,42,0.08))"
                      : "var(--boa-paper-2)",
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span
                      className="boa-display text-[16px]"
                      style={{ color: "var(--boa-ink)" }}
                    >
                      {t.name}
                    </span>
                    {isSelected && (
                      <Check
                        className="w-4 h-4 shrink-0"
                        style={{ color: "var(--boa-brass)" }}
                      />
                    )}
                  </div>
                  <p
                    className="text-[12.5px] mb-2 line-clamp-2"
                    style={{ color: "var(--boa-ink-2)" }}
                  >
                    {t.description}
                  </p>
                  <div
                    className="flex items-center gap-1.5 boa-mono text-[10px] uppercase tracking-[0.15em]"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    <Users className="w-3 h-3" />
                    {t.size} advisors · {t.presets.map((p) => p.name).join(" · ")}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <Field label="Board name" required>
          <Input
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="Capital Allocation Council"
            required
          />
        </Field>

        <div className="grid md:grid-cols-2 gap-6">
          <Field label="Topic area">
            <Input
              value={formData.topicArea}
              onChange={(e) => setFormData((p) => ({ ...p, topicArea: e.target.value }))}
              placeholder="Capital allocation"
            />
          </Field>
          <Field label="Board size">
            <Select value={formData.size} onValueChange={(v) => setFormData((p) => ({ ...p, size: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 advisors</SelectItem>
                <SelectItem value="5">5 advisors</SelectItem>
                <SelectItem value="7">7 advisors</SelectItem>
                <SelectItem value="9">9 advisors</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
            placeholder="What decisions does this council handle?"
            className="min-h-[80px]"
          />
        </Field>

        <Field
          label="Master instructions"
          hint={`${formData.masterInstructionsText.length} / 7500 chars`}
        >
          <Textarea
            value={formData.masterInstructionsText}
            onChange={(e) => setFormData((p) => ({ ...p, masterInstructionsText: e.target.value }))}
            placeholder="System framing applied to every member and the chair…"
            className="min-h-[200px] boa-mono text-[12.5px]"
          />
        </Field>

        <div
          className="flex justify-end gap-3 pt-6 border-t boa-rule"
        >
          <Link href={`/t/${tenantId}/boards`}>
            <button
              type="button"
              className="px-4 py-2 rounded-sm text-[13px] border hover:bg-[color:var(--boa-paper-2)] transition-colors"
              style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
            >
              Cancel
            </button>
          </Link>
          <button
            type="submit"
            disabled={submitting || !formData.name}
            className="boa-cta px-5 py-2 rounded-sm text-[13px] font-medium disabled:opacity-50 inline-flex items-center"
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            {selectedTemplate ? "Create & seat advisors" : "Create board"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label
          className="boa-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--boa-ink-3)" }}
        >
          {label}
          {required && <span style={{ color: "var(--boa-vote-no)" }}> *</span>}
        </Label>
        {hint && (
          <span className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
