import { useState, useRef } from "react";
import {
  useListRosterAdvisors,
  useCreateRosterAdvisor,
  useUpdateRosterAdvisor,
  useDeleteRosterAdvisor,
  useRequestUploadUrl,
  useRegisterGroundingDocument,
  type RosterAdvisor,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  Plus,
  Trash2,
  Pencil,
  FileText,
  Upload,
  Loader2,
  FileUp,
} from "lucide-react";

interface Props {
  tenantId: string;
}

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.doc,.txt,.md";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function AdvisorFormDialog({
  open,
  onOpenChange,
  tenantId,
  initial,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  initial?: RosterAdvisor;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const create = useCreateRosterAdvisor();
  const update = useUpdateRosterAdvisor();

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    roleTitle: initial?.roleTitle ?? "",
    lensDescription: initial?.lensDescription ?? "",
    instructionsText: initial?.instructionsText ?? "",
  });

  const isEdit = !!initial;
  const isPending = create.isPending || update.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (isEdit) {
        await update.mutateAsync({
          advisorId: initial!.id,
          data: {
            name: form.name,
            roleTitle: form.roleTitle,
            lensDescription: form.lensDescription || null,
            instructionsText: form.instructionsText,
          },
        });
        toast({ title: "Advisor updated" });
      } else {
        await create.mutateAsync({
          data: {
            tenantId,
            name: form.name,
            roleTitle: form.roleTitle,
            lensDescription: form.lensDescription || undefined,
            instructionsText: form.instructionsText,
          },
        });
        toast({ title: "Advisor added to roster" });
      }
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: isEdit ? "Failed to update" : "Failed to create",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="boa max-w-[680px] w-[95vw]"
        style={{ background: "var(--boa-paper)", color: "var(--boa-ink)" }}
      >
        <DialogHeader>
          <DialogTitle className="boa-display text-[22px]">
            {isEdit ? "Edit advisor" : "Add advisor to roster"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="boa-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--boa-ink-3)" }}>
                Name *
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Bill Belichick"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="boa-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--boa-ink-3)" }}>
                Role title *
              </label>
              <Input
                value={form.roleTitle}
                onChange={(e) => setForm((p) => ({ ...p, roleTitle: e.target.value }))}
                placeholder="Execution Readiness"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="boa-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--boa-ink-3)" }}>
              Lens <span style={{ color: "var(--boa-ink-3)" }}>(one-line summary)</span>
            </label>
            <Input
              value={form.lensDescription}
              onChange={(e) => setForm((p) => ({ ...p, lensDescription: e.target.value }))}
              placeholder="Execution discipline, preparation, role clarity…"
            />
          </div>
          <div className="space-y-1.5">
            <label className="boa-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--boa-ink-3)" }}>
              Instructions <span style={{ color: "var(--boa-ink-3)" }}>({form.instructionsText.length} chars)</span>
            </label>
            <Textarea
              value={form.instructionsText}
              onChange={(e) => setForm((p) => ({ ...p, instructionsText: e.target.value }))}
              placeholder="Paste the full system prompt for this advisor…"
              className="min-h-[200px] boa-mono text-[12px]"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-sm text-[13px] border"
              style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="boa-cta px-5 py-2 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              {isEdit ? "Save changes" : "Add to roster"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DocUploadButton({
  tenantId,
  advisorId,
  hasDoc,
  onDone,
}: {
  tenantId: string;
  advisorId: string;
  hasDoc: boolean;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const requestUrl = useRequestUploadUrl();
  const registerDoc = useRegisterGroundingDocument();
  const updateAdvisor = useUpdateRosterAdvisor();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { uploadURL, objectPath } = await requestUrl.mutateAsync({
        data: { name: file.name, size: file.size, contentType: file.type || "application/octet-stream" },
      });
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      const doc = await registerDoc.mutateAsync({
        data: {
          tenantId,
          objectPath,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
        },
      });
      await updateAdvisor.mutateAsync({
        advisorId,
        data: { groundingDocumentId: doc.id },
      });
      toast({ title: "Document attached", description: file.name });
      onDone();
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border text-[12px] transition-colors hover:bg-[color:var(--boa-paper-2)] disabled:opacity-50"
        style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
        title={hasDoc ? "Replace grounding document" : "Attach grounding document"}
      >
        {uploading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <FileUp className="w-3 h-3" />
        )}
        {hasDoc ? "Replace doc" : "Attach doc"}
      </button>
    </>
  );
}

function AdvisorCard({
  advisor,
  tenantId,
  onRefetch,
}: {
  advisor: RosterAdvisor;
  tenantId: string;
  onRefetch: () => void;
}) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteAdvisor = useDeleteRosterAdvisor();

  async function handleDelete() {
    try {
      await deleteAdvisor.mutateAsync({ advisorId: advisor.id });
      toast({ title: "Advisor removed from roster" });
      onRefetch();
    } catch (err) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  const doc = advisor.groundingDocument;

  return (
    <>
      <div
        className="border rounded-sm p-5 flex items-start gap-4"
        style={{ borderColor: "var(--boa-rule)", background: "var(--boa-paper)" }}
      >
        <div
          className="w-10 h-10 rounded-sm shrink-0 flex items-center justify-center mt-0.5"
          style={{ background: "var(--boa-brass-tint)", color: "var(--boa-brass)" }}
        >
          <Users className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="boa-display text-[17px] leading-tight" style={{ color: "var(--boa-ink)" }}>
                {advisor.name}
              </h3>
              <div className="boa-mono text-[10px] uppercase tracking-[0.15em] mt-0.5" style={{ color: "var(--boa-ink-3)" }}>
                {advisor.roleTitle}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <DocUploadButton
                tenantId={tenantId}
                advisorId={advisor.id}
                hasDoc={!!doc}
                onDone={onRefetch}
              />
              <button
                onClick={() => setEditOpen(true)}
                className="p-1.5 rounded-sm border transition-colors hover:bg-[color:var(--boa-paper-2)]"
                style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
                title="Edit advisor"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-sm border transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-vote-no)" }}
                title="Remove from roster"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {advisor.lensDescription && (
            <p className="text-[13px] mt-2" style={{ color: "var(--boa-ink-2)" }}>
              {advisor.lensDescription}
            </p>
          )}

          <div className="mt-3 flex items-center gap-3">
            {doc ? (
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded-sm flex items-center justify-center"
                  style={{ background: "rgba(74,164,108,0.12)", color: "#4aa46c" }}
                >
                  <FileText className="w-3 h-3" />
                </div>
                <span className="text-[12px]" style={{ color: "var(--boa-ink-2)" }}>
                  {doc.filename}
                </span>
                <span className="boa-mono text-[10px]" style={{ color: "var(--boa-ink-3)" }}>
                  {doc.characterCount.toLocaleString()} chars
                  {doc.truncated ? " · truncated" : ""}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-sm flex items-center justify-center"
                  style={{ background: "rgba(196,106,42,0.1)", color: "var(--boa-brass)" }}
                >
                  <FileText className="w-3 h-3" />
                </div>
                <span className="boa-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: "var(--boa-brass)" }}>
                  No grounding document
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <AdvisorFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        tenantId={tenantId}
        initial={advisor}
        onSuccess={onRefetch}
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="boa max-w-[400px]" style={{ background: "var(--boa-paper)" }}>
          <DialogHeader>
            <DialogTitle className="boa-display text-[20px]">Remove from roster?</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] mt-2" style={{ color: "var(--boa-ink-2)" }}>
            <strong>{advisor.name}</strong> will be removed from the roster. Any boards that already seated them are unaffected.
          </p>
          <DialogFooter className="mt-4">
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-4 py-2 rounded-sm text-[13px] border"
              style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteAdvisor.isPending}
              className="px-4 py-2 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
              style={{ background: "var(--boa-vote-no)", color: "white" }}
            >
              {deleteAdvisor.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Remove
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Roster({ tenantId }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: advisors = [], isLoading, queryKey } = useListRosterAdvisors(
    { tenantId },
  );

  function refetch() {
    qc.invalidateQueries({ queryKey });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-2 text-muted-foreground">
            Advisor Roster
          </div>
          <h1 className="boa-display text-3xl mb-2" style={{ color: "var(--boa-ink)" }}>
            Named Advisors
          </h1>
          <p className="text-[14px] text-muted-foreground max-w-xl">
            Build your reusable roster of named advisors. Each carries their instructions and grounding document, so seating them on any board is one click.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="boa-cta flex items-center gap-2 px-4 py-2.5 rounded-sm text-[13px] font-medium shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Advisor
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : advisors.length === 0 ? (
        <div
          className="rounded-lg border border-dashed flex flex-col items-center justify-center py-20 gap-4"
          style={{ borderColor: "var(--boa-rule)" }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "var(--boa-paper-2, var(--boa-rule))" }}
          >
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-medium text-foreground mb-1">No advisors yet</p>
            <p className="text-[13px] text-muted-foreground max-w-xs">
              Add your first named advisor. They'll be available to seat on any board in one click, with their document automatically attached.
            </p>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="boa-cta flex items-center gap-2 px-4 py-2 rounded-sm text-[13px] font-medium"
          >
            <Plus className="w-4 h-4" />
            Add first advisor
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {advisors.map((a) => (
            <AdvisorCard
              key={a.id}
              advisor={a}
              tenantId={tenantId}
              onRefetch={refetch}
            />
          ))}
        </div>
      )}

      <AdvisorFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tenantId={tenantId}
        onSuccess={refetch}
      />
    </div>
  );
}
