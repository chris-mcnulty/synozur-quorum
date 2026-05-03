import { useRef, useState } from "react";
import {
  useListGroundingDocuments,
  useRegisterGroundingDocument,
  useDeleteGroundingDocument,
  useRequestUploadUrl,
  type GroundingDocument,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  Trash2,
  Upload,
  FileType,
  Brain,
  Loader2,
  FilePlus,
} from "lucide-react";

interface Props {
  tenantId: string;
}

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
};

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.doc,.txt,.md";

function fileTypeLabel(contentType: string): string {
  const ext = ACCEPTED_TYPES[contentType.toLowerCase().split(";")[0]?.trim() ?? ""];
  return ext ? ext.toUpperCase() : contentType.split("/")[1]?.toUpperCase() ?? "FILE";
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function FileIcon({ contentType }: { contentType: string }) {
  const ext = ACCEPTED_TYPES[contentType.toLowerCase().split(";")[0]?.trim() ?? ""] ?? "";
  if (ext === "pdf") return <FileText className="w-5 h-5" style={{ color: "#c45" }} />;
  if (ext === "docx" || ext === "doc") return <FileText className="w-5 h-5" style={{ color: "#4a90e2" }} />;
  if (ext === "md") return <FileType className="w-5 h-5" style={{ color: "#9b59b6" }} />;
  return <FileText className="w-5 h-5 text-muted-foreground" />;
}

export default function GroundingDocs({ tenantId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: docs = [], isLoading, queryKey } = useListGroundingDocuments(
    { tenantId },
    { query: { enabled: !!tenantId } },
  );

  const requestUrl = useRequestUploadUrl();
  const register = useRegisterGroundingDocument({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey });
        setOpen(false);
        setSelectedFile(null);
        toast({ title: "Document uploaded", description: "Text extraction is complete." });
      },
      onError: (err: Error) => {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      },
    },
  });
  const remove = useDeleteGroundingDocument({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey });
        toast({ title: "Document removed" });
      },
      onError: (err: Error) => {
        toast({ title: "Delete failed", description: err.message, variant: "destructive" });
      },
    },
  });

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
  }

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const { uploadURL, objectPath } = await requestUrl.mutateAsync({
        data: {
          name: selectedFile.name,
          size: selectedFile.size,
          contentType: selectedFile.type || "application/octet-stream",
        },
      });

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: selectedFile,
        headers: { "Content-Type": selectedFile.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error(`Storage upload failed (${putRes.status})`);

      await register.mutateAsync({
        data: {
          tenantId,
          objectPath,
          filename: selectedFile.name,
          contentType: selectedFile.type || "application/octet-stream",
          size: selectedFile.size,
        },
      });
    } catch (err: unknown) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || register.isPending;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-2 text-muted-foreground">
            AI Grounding
          </div>
          <h1 className="boa-display text-3xl mb-2" style={{ color: "var(--boa-ink)" }}>
            Context Documents
          </h1>
          <p className="text-[14px] text-muted-foreground max-w-xl">
            Upload company documents — strategy briefs, mission statements, annual reports — to ground the advisory AI with accurate context during board sessions.
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="boa-cta flex items-center gap-2 px-4 py-2.5 rounded-sm text-[13px] font-medium shrink-0"
        >
          <Upload className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <div
          className="rounded-lg border border-dashed flex flex-col items-center justify-center py-20 gap-4"
          style={{ borderColor: "var(--boa-rule)" }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "var(--boa-paper-2, var(--boa-rule))" }}
          >
            <Brain className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-medium text-foreground mb-1">No documents yet</p>
            <p className="text-[13px] text-muted-foreground max-w-xs">
              Upload a PDF, Word document, or text file to give the advisory AI your company's context.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="boa-cta flex items-center gap-2 px-4 py-2 rounded-sm text-[13px] font-medium mt-2"
          >
            <FilePlus className="w-4 h-4" />
            Upload your first document
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(docs as GroundingDocument[]).map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-4 p-4 rounded-lg border transition-colors"
              style={{ borderColor: "var(--boa-rule)", background: "var(--boa-paper)" }}
            >
              <div
                className="w-10 h-10 rounded-md flex items-center justify-center shrink-0"
                style={{ background: "var(--boa-rule)" }}
              >
                <FileIcon contentType={doc.contentType} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium truncate text-foreground">
                  {doc.filename}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="boa-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {fileTypeLabel(doc.contentType)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {doc.characterCount.toLocaleString()} chars
                    {doc.truncated && " (truncated)"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(doc.uploadedAt)}
                  </span>
                </div>
              </div>
              <span
                className="boa-mono text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-sm shrink-0"
                style={{
                  background: "color-mix(in srgb, var(--boa-vote-yes) 12%, transparent)",
                  color: "var(--boa-vote-yes)",
                }}
              >
                Processed
              </span>
              <button
                onClick={() => remove.mutate({ documentId: doc.id })}
                disabled={remove.isPending}
                title="Remove document"
                className="p-1.5 rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Accepted formats note */}
      {docs.length > 0 && (
        <p className="boa-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-6">
          Accepted formats · PDF · DOCX · TXT · MD · Max 20 MB
        </p>
      )}

      {/* Upload dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!busy) { setOpen(v); if (!v) setSelectedFile(null); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Upload Context Document</DialogTitle>
            <DialogDescription>
              Choose a PDF, Word document, plain text, or Markdown file. Text will be extracted and injected into advisory session prompts for this organisation.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 flex flex-col gap-4">
            {/* File picker */}
            <div
              className="rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer py-10 transition-colors"
              style={{ borderColor: selectedFile ? "var(--boa-brass)" : "var(--boa-rule)" }}
              onClick={() => !busy && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={onFileChange}
              />
              {selectedFile ? (
                <>
                  <FileIcon contentType={selectedFile.type} />
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-foreground">{selectedFile.name}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{formatBytes(selectedFile.size)}</p>
                  </div>
                  {!busy && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="text-[12px] text-muted-foreground underline"
                    >
                      Choose different file
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-foreground">Click to choose a file</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">PDF, DOCX, TXT, MD — up to 20 MB</p>
                  </div>
                </>
              )}
            </div>

            {/* Grounding context note */}
            <div
              className="rounded-md px-3 py-2.5 flex items-start gap-2"
              style={{ background: "color-mix(in srgb, var(--boa-brass) 8%, transparent)" }}
            >
              <Brain className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--boa-brass)" }} />
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                Extracted text is used as AI grounding context for all advisory sessions run for this organisation.
              </p>
            </div>
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => { setOpen(false); setSelectedFile(null); }}
              disabled={busy}
              className="px-4 py-2 rounded-sm text-[13px] border transition-colors"
              style={{ borderColor: "var(--boa-rule)", color: "var(--boa-ink-3)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || busy}
              className="boa-cta flex items-center gap-2 px-4 py-2 rounded-sm text-[13px] font-medium disabled:opacity-50"
            >
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {busy ? "Uploading…" : "Upload & Process"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
