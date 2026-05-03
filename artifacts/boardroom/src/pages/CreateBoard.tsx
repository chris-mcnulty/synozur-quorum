import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateBoard } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2 } from "lucide-react";

export default function CreateBoard({ tenantId }: { tenantId: string }) {
  const [, setLocation] = useLocation();
  const createBoard = useCreateBoard();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    topicArea: "",
    size: "5",
    masterInstructionsText: "",
  });

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
      setLocation(`/t/${tenantId}/boards/${board.id}`);
    } catch (err) {
      toast({
        title: "Error creating board",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-[760px] mx-auto px-8 py-10">
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
            disabled={createBoard.isPending || !formData.name}
            className="boa-cta px-5 py-2 rounded-sm text-[13px] font-medium disabled:opacity-50 inline-flex items-center"
          >
            {createBoard.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
            Create board
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
