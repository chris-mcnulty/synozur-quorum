import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  useListBoards,
  useCreateCrossExamination,
  useRequestUploadUrl,
  SessionMode,
} from "@workspace/api-client-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft,
  Loader2,
  Play,
  MessageSquare,
  Scale,
  CheckSquare,
  Layers3,
  Paperclip,
  X,
  FileText,
} from "lucide-react";

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "text/plain": "txt",
  "text/markdown": "md",
};

function fileTypeLabel(contentType: string): string {
  return ACCEPTED_TYPES[contentType] ?? "doc";
}

export default function CrossExamLauncher({ tenantId }: { tenantId: string }) {
  const [, setLocation] = useLocation();
  const { data: boards, isLoading } = useListBoards(tenantId);
  const create = useCreateCrossExamination();
  const requestUploadUrl = useRequestUploadUrl();
  const { toast } = useToast();

  const [selected, setSelected] = useState<string[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [mode, setMode] = useState<SessionMode>(SessionMode.ADVISORY);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedObjectPath, setUploadedObjectPath] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const eligibleBoards = (boards ?? []).filter((b) => b.memberCount > 0);
  const valid =
    questionText.trim().length > 0 &&
    selected.length >= 2 &&
    selected.length <= 4;

  const toggleBoard = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((b) => b !== id)
        : prev.length < 4
        ? [...prev, id]
        : prev,
    );
  };

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
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadedObjectPath(null);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleConvene = async () => {
    if (!valid) return;
    try {
      const result = await create.mutateAsync({
        tenantId,
        data: {
          questionText,
          boardIds: selected,
          mode,
          ...(uploadedObjectPath && selectedFile
            ? {
                questionDocumentPath: uploadedObjectPath,
                questionDocumentFilename: selectedFile.name,
                questionDocumentContentType: selectedFile.type || "application/octet-stream",
              }
            : {}),
        },
      });
      setLocation(`/cross-examinations/${result.id}`);
    } catch (err) {
      toast({
        title: "Error starting cross-examination",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

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
      desc: "Each board votes YES / NO / ABSTAIN.",
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
    <div className="max-w-[920px] mx-auto px-8 py-10">
      <Link
        href={`/t/${tenantId}`}
        className="inline-flex items-center text-[12px] mb-6 boa-mono uppercase tracking-[0.15em] hover:underline"
        style={{ color: "var(--boa-ink-3)" }}
      >
        <ChevronLeft className="w-3.5 h-3.5 mr-1" />
        Back to overview
      </Link>

      <header className="mb-10">
        <div
          className="boa-mono text-[11px] uppercase tracking-[0.18em] mb-3 flex items-center gap-2"
          style={{ color: "var(--boa-brass)" }}
        >
          <Layers3 className="w-3.5 h-3.5" />
          Cross-examination
        </div>
        <h1
          className="boa-display text-[36px] leading-tight"
          style={{ color: "var(--boa-ink)" }}
        >
          Put one question to multiple councils
        </h1>
        <p className="text-[14px] mt-2 max-w-2xl" style={{ color: "var(--boa-ink-3)" }}>
          Select 2–4 boards. Each will deliberate independently in parallel,
          then a Master synthesizer compares where they align, where they
          diverge, and what each board uniquely surfaced.
        </p>
      </header>

      <section className="mb-10">
        <h2
          className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-4 pb-2 border-b boa-rule flex justify-between"
          style={{ color: "var(--boa-ink-3)" }}
        >
          <span>Boards ({selected.length}/4 selected)</span>
          <span>min 2 · max 4</span>
        </h2>
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : eligibleBoards.length < 2 ? (
          <div
            className="border boa-rule rounded-sm p-6 text-center"
            style={{ color: "var(--boa-ink-3)" }}
          >
            <p className="text-[14px] mb-3">
              You need at least 2 boards with members to run a cross-examination.
            </p>
            <Link href={`/t/${tenantId}/boards/new`}>
              <button className="boa-cta px-3.5 py-2 rounded-sm text-[12.5px] font-medium">
                Create board
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {eligibleBoards.map((b) => {
              const active = selected.includes(b.id);
              const disabled = !active && selected.length >= 4;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => !disabled && toggleBoard(b.id)}
                  disabled={disabled}
                  className="text-left p-4 boa-surface rounded-sm transition-colors disabled:opacity-50"
                  style={{
                    borderColor: active ? "var(--boa-ink)" : "var(--boa-paper-3)",
                    background: active ? "var(--boa-paper)" : "var(--boa-paper-2)",
                    boxShadow: active
                      ? "inset 0 0 0 1px var(--boa-brass)"
                      : "none",
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div
                      className="boa-display text-[18px] leading-tight"
                      style={{ color: "var(--boa-ink)" }}
                    >
                      {b.name}
                    </div>
                    <div
                      className="boa-mono text-[10px] uppercase tracking-wider"
                      style={{
                        color: active ? "var(--boa-brass)" : "var(--boa-ink-3)",
                      }}
                    >
                      {active ? "✓ selected" : `${b.memberCount} advisors`}
                    </div>
                  </div>
                  {b.topicArea && (
                    <div
                      className="boa-mono text-[10px] uppercase tracking-wider mb-1"
                      style={{ color: "var(--boa-ink-3)" }}
                    >
                      {b.topicArea}
                    </div>
                  )}
                  {b.description && (
                    <p
                      className="text-[12.5px] line-clamp-2"
                      style={{ color: "var(--boa-ink-2)" }}
                    >
                      {b.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2
          className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-4 pb-2 border-b boa-rule"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Mode (applied to every board)
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
                  style={{
                    color: active ? "var(--boa-brass)" : "var(--boa-ink-3)",
                  }}
                />
                <div
                  className="boa-display text-[16px]"
                  style={{ color: "var(--boa-ink)" }}
                >
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
          placeholder="State the strategic question. e.g. 'Should we expand into Europe in Q3?'"
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
        />
      </section>

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
          Attach a document to give every council additional context. Its extracted text will be
          injected into each advisor's deliberation across all boards.
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

      <div className="flex justify-end gap-3 pt-6 border-t boa-rule">
        <Link href={`/t/${tenantId}`}>
          <button
            type="button"
            className="px-4 py-2 rounded-sm text-[13px] border"
            style={{
              borderColor: "var(--boa-paper-3)",
              color: "var(--boa-ink-2)",
            }}
          >
            Cancel
          </button>
        </Link>
        <button
          onClick={handleConvene}
          disabled={create.isPending || !valid}
          className="boa-cta-brass px-5 py-2.5 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
        >
          {create.isPending ? (
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 mr-2" fill="currentColor" />
          )}
          Convene cross-examination
        </button>
      </div>
    </div>
  );
}
