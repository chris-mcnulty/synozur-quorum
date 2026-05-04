import { useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetBoard, useCreateSession, useRequestUploadUrl, useListTenants, SessionMode } from "@workspace/api-client-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, Play, MessageSquare, Scale, CheckSquare, Paperclip, X, FileText, Lock } from "lucide-react";

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
};

function fileTypeLabel(contentType: string): string {
  const ct = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  const ext = ACCEPTED_TYPES[ct];
  return ext ? ext.toUpperCase() : ct.split("/")[1]?.toUpperCase() ?? "FILE";
}

export default function SessionRunner({
  tenantId,
  boardId,
}: {
  tenantId: string;
  boardId: string;
}) {
  const [, setLocation] = useLocation();
  const { data: boardDetail, isLoading } = useGetBoard(boardId);
  const { data: tenants } = useListTenants();
  const createSession = useCreateSession();
  const requestUploadUrl = useRequestUploadUrl();
  const { toast } = useToast();

  const userRole = tenants?.find((t) => t.tenant.id === tenantId)?.role;
  const canSubmit = userRole === "OWNER" || userRole === "ADMIN" || userRole === "EDITOR";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<SessionMode>(SessionMode.ADVISORY);
  const [questionText, setQuestionText] = useState("");
  const [allHands, setAllHands] = useState(false);
  const [includeResolvedDecisions, setIncludeResolvedDecisions] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedObjectPath, setUploadedObjectPath] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ct = file.type || "application/octet-stream";
    if (!ACCEPTED_TYPES[ct]) {
      toast({
        title: "Unsupported file type",
        description: "Please attach a PDF, DOCX, DOC, TXT, or Markdown file.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    setUploadedObjectPath(null);
    setIsUploading(true);

    try {
      const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
        data: {
          name: file.name,
          size: file.size,
          contentType: ct,
        },
      });
      await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": ct },
        body: file,
      });
      setUploadedObjectPath(objectPath);
    } catch (err) {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Could not upload document.",
        variant: "destructive",
      });
      setSelectedFile(null);
      setUploadedObjectPath(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadedObjectPath(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConvene = async () => {
    if (!questionText) return;
    try {
      const session = await createSession.mutateAsync({
        boardId,
        data: {
          mode,
          questionText,
          allHands,
          includeResolvedDecisions,
          ...(uploadedObjectPath && selectedFile
            ? {
                questionDocumentPath: uploadedObjectPath,
                questionDocumentFilename: selectedFile.name,
                questionDocumentContentType: selectedFile.type || "application/octet-stream",
              }
            : {}),
        },
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

      {!canSubmit && userRole && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-sm border mb-8"
          style={{ borderColor: "var(--boa-paper-3)", background: "var(--boa-paper-2)" }}
        >
          <Lock className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--boa-ink-3)" }} />
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--boa-ink-2)" }}>
            You have <strong>viewer</strong> access to this workspace. Submitting questions requires editor access or higher. Contact a workspace owner to request an upgrade.
          </p>
        </div>
      )}

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
                  background: active ? "var(--boa-paper)" : "var(--boa-paper-2)",
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

      {/* Supporting document */}
      <section className="mb-10">
        <h2
          className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-4 pb-2 border-b boa-rule"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Supporting document
          <span
            className="ml-2 normal-case tracking-normal font-normal"
            style={{ opacity: 0.55 }}
          >
            — optional
          </span>
        </h2>
        <p className="text-[13px] mb-4" style={{ color: "var(--boa-ink-3)" }}>
          Attach a document to give the council additional context for this specific question.
          Its extracted text will be injected into every advisor's deliberation.
        </p>

        {!selectedFile ? (
          <label
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-sm border cursor-pointer text-[13px] transition-opacity hover:opacity-70"
            style={{
              borderColor: "var(--boa-paper-3)",
              color: "var(--boa-ink-2)",
              background: "var(--boa-paper-2)",
            }}
          >
            <Paperclip className="w-3.5 h-3.5" />
            Attach document
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.md,.markdown"
              onChange={handleFileSelect}
            />
          </label>
        ) : (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-sm border"
            style={{
              borderColor: isUploading ? "var(--boa-paper-3)" : "var(--boa-brass)",
              background: "var(--boa-paper-2)",
            }}
          >
            {isUploading ? (
              <Loader2
                className="w-4 h-4 animate-spin shrink-0"
                style={{ color: "var(--boa-brass)" }}
              />
            ) : (
              <FileText className="w-4 h-4 shrink-0" style={{ color: "var(--boa-brass)" }} />
            )}
            <div className="flex-1 min-w-0">
              <div
                className="text-[13px] font-medium truncate"
                style={{ color: "var(--boa-ink)" }}
              >
                {selectedFile.name}
              </div>
              <div
                className="boa-mono text-[10px] uppercase tracking-wider mt-0.5"
                style={{ color: "var(--boa-ink-3)" }}
              >
                {isUploading
                  ? "Uploading…"
                  : uploadedObjectPath
                  ? `${fileTypeLabel(selectedFile.type)} · ready`
                  : "Upload failed"}
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="shrink-0 p-1 rounded hover:opacity-70 transition-opacity"
              style={{ color: "var(--boa-ink-3)" }}
              title="Remove document"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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

      <section
        className="mb-10 flex items-center justify-between p-4 border rounded-sm"
        style={{ borderColor: "var(--boa-paper-3)", background: "var(--boa-paper-2)" }}
      >
        <div>
          <div className="text-[14px] font-medium" style={{ color: "var(--boa-ink)" }}>
            Include prior decisions
          </div>
          <p className="text-[12px]" style={{ color: "var(--boa-ink-3)" }}>
            Feed the last 5 resolved decisions on this board into the chair's framing as
            institutional memory.
          </p>
        </div>
        <Switch
          checked={includeResolvedDecisions}
          onCheckedChange={setIncludeResolvedDecisions}
        />
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
            !canSubmit ||
            createSession.isPending ||
            isUploading ||
            !questionText ||
            boardDetail.members.length === 0
          }
          title={!canSubmit ? "Editor access required to submit questions" : undefined}
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
