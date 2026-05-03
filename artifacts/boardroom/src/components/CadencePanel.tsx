import { useState } from "react";
import { Link } from "wouter";
import {
  useListCadences,
  useCreateCadence,
  useUpdateCadence,
  useDeleteCadence,
  useListCadenceRuns,
  type Cadence,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pause, Play, Trash2, Edit, Clock, X } from "lucide-react";

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const COMMON_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

interface VariableRow {
  key: string;
  value: string;
}

interface FormState {
  id?: string;
  name: string;
  frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  dayOfWeek: number;
  dayOfMonth: number;
  hour: number;
  minute: number;
  timezone: string;
  mode: "ADVISORY" | "BOARD" | "REVIEW";
  questionTemplate: string;
  templateVariables: VariableRow[];
  recipients: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  frequency: "WEEKLY",
  dayOfWeek: 1,
  dayOfMonth: 1,
  hour: 9,
  minute: 0,
  timezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC",
  mode: "ADVISORY",
  questionTemplate:
    "What is the most important decision facing us about {{topic}} this week?",
  templateVariables: [{ key: "topic", value: "capital allocation" }],
  recipients: "",
};

function formatNextRun(c: Cadence): string {
  if (c.paused) return "Paused";
  if (!c.nextRunAt) return "—";
  return new Date(c.nextRunAt).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function describeSchedule(c: Cadence): string {
  const time = `${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;
  if (c.frequency === "MONTHLY") {
    return `Monthly on day ${c.dayOfMonth ?? 1} at ${time} ${c.timezone}`;
  }
  const day = DAYS_OF_WEEK[c.dayOfWeek ?? 1];
  const adv = c.frequency === "BIWEEKLY" ? "Every other " : "Every ";
  return `${adv}${day} at ${time} ${c.timezone}`;
}

export default function CadencePanel({ boardId }: { boardId: string }) {
  const { toast } = useToast();
  const { data: cadences, refetch, isLoading } = useListCadences(boardId);
  const createMutation = useCreateCadence();
  const updateMutation = useUpdateCadence();
  const deleteMutation = useDeleteCadence();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  };

  const openEdit = (c: Cadence) => {
    const vars = c.templateVariables ?? {};
    setForm({
      id: c.id,
      name: c.name,
      frequency: c.frequency,
      dayOfWeek: c.dayOfWeek ?? 1,
      dayOfMonth: c.dayOfMonth ?? 1,
      hour: c.hour,
      minute: c.minute,
      timezone: c.timezone,
      mode: c.mode,
      questionTemplate: c.questionTemplate,
      templateVariables:
        Object.entries(vars as Record<string, string>).map(([key, value]) => ({
          key,
          value: String(value ?? ""),
        })) || [],
      recipients: (c.recipients ?? []).join(", "),
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    const recipients = form.recipients
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const templateVariables: Record<string, string> = {};
    for (const row of form.templateVariables) {
      const k = row.key.trim();
      if (k) templateVariables[k] = row.value;
    }
    const payload = {
      name: form.name,
      frequency: form.frequency,
      dayOfWeek:
        form.frequency === "MONTHLY" ? null : form.dayOfWeek,
      dayOfMonth:
        form.frequency === "MONTHLY" ? form.dayOfMonth : null,
      hour: form.hour,
      minute: form.minute,
      timezone: form.timezone,
      mode: form.mode,
      questionTemplate: form.questionTemplate,
      recipients,
      templateVariables,
    };
    try {
      if (form.id) {
        await updateMutation.mutateAsync({
          cadenceId: form.id,
          data: payload,
        });
        toast({ title: "Cadence updated" });
      } else {
        await createMutation.mutateAsync({ boardId, data: payload });
        toast({ title: "Cadence created" });
      }
      setDrawerOpen(false);
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const handlePauseToggle = async (c: Cadence) => {
    try {
      await updateMutation.mutateAsync({
        cadenceId: c.id,
        data: { paused: !c.paused },
      });
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (c: Cadence) => {
    if (!confirm(`Delete cadence "${c.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync({ cadenceId: c.id });
      refetch();
    } catch (err) {
      toast({
        title: "Error",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="boa-display text-[22px]">Recurring cadence</h2>
          <p className="text-[13px] mt-1" style={{ color: "var(--boa-ink-2)" }}>
            Schedule the council to convene automatically and email the digest
            to recipients.
          </p>
        </div>
        <button
          data-testid="button-add-cadence"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
          style={{ borderColor: "var(--boa-ink)", color: "var(--boa-ink)" }}
        >
          <Plus className="w-3 h-3" /> New cadence
        </button>
      </div>

      {isLoading && (
        <Loader2
          className="w-4 h-4 animate-spin"
          style={{ color: "var(--boa-brass)" }}
        />
      )}

      <div className="border-t border-b boa-rule-strong divide-y boa-rule">
        {(cadences ?? []).map((c) => (
          <div key={c.id} className="py-4">
            <div className="flex items-start gap-4">
              <Clock
                className="w-4 h-4 mt-1"
                style={{ color: "var(--boa-brass)" }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="boa-display text-[16px]"
                  style={{ color: "var(--boa-ink)" }}
                  data-testid={`cadence-name-${c.id}`}
                >
                  {c.name}
                  {c.paused && (
                    <span
                      className="ml-2 boa-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                      style={{
                        background: "var(--boa-paper-3)",
                        color: "var(--boa-ink-3)",
                      }}
                    >
                      Paused
                    </span>
                  )}
                </div>
                <div
                  className="boa-mono text-[11px] uppercase tracking-wider mt-1"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  {describeSchedule(c)} · Mode {c.mode}
                </div>
                <div
                  className="text-[12px] mt-1"
                  style={{ color: "var(--boa-ink-2)" }}
                >
                  Next: {formatNextRun(c)}
                  {c.lastRunAt && (
                    <>
                      {"  ·  Last: "}
                      {new Date(c.lastRunAt).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </>
                  )}
                </div>
                {c.recipients.length > 0 && (
                  <div
                    className="text-[12px] mt-1"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    Recipients: {c.recipients.join(", ")}
                  </div>
                )}
                <button
                  onClick={() =>
                    setHistoryOpenFor(historyOpenFor === c.id ? null : c.id)
                  }
                  className="mt-2 boa-mono text-[10px] uppercase tracking-[0.18em] underline"
                  style={{ color: "var(--boa-brass)" }}
                >
                  {historyOpenFor === c.id ? "Hide history" : "Show history"}
                </button>
                {historyOpenFor === c.id && (
                  <CadenceHistory cadenceId={c.id} />
                )}
              </div>
              <button
                onClick={() => handlePauseToggle(c)}
                title={c.paused ? "Resume" : "Pause"}
                data-testid={`button-pause-${c.id}`}
                className="p-1.5 rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
                style={{ color: "var(--boa-ink-2)" }}
              >
                {c.paused ? (
                  <Play className="w-3.5 h-3.5" />
                ) : (
                  <Pause className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => openEdit(c)}
                className="p-1.5 rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
                style={{ color: "var(--boa-ink-2)" }}
              >
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(c)}
                className="p-1.5 rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
                style={{ color: "var(--boa-vote-no)" }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {(cadences ?? []).length === 0 && !isLoading && (
          <div
            className="py-12 text-center"
            style={{ color: "var(--boa-ink-3)" }}
          >
            <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <div className="boa-mono text-[10px] uppercase tracking-[0.18em]">
              No cadences scheduled
            </div>
          </div>
        )}
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          style={{ background: "rgba(20,16,8,0.45)" }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="w-full max-w-md h-full overflow-y-auto p-6 space-y-4"
            style={{ background: "var(--boa-paper)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="boa-display text-[20px]">
              {form.id ? "Edit cadence" : "New cadence"}
            </h3>

            <Field label="Name">
              <input
                data-testid="input-cadence-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-2 py-1.5 border boa-rule rounded-sm boa-mono text-[12px]"
                placeholder="Weekly capital allocation review"
              />
            </Field>

            <Field label="Frequency">
              <select
                value={form.frequency}
                onChange={(e) =>
                  setForm({
                    ...form,
                    frequency: e.target.value as FormState["frequency"],
                  })
                }
                className="w-full px-2 py-1.5 border boa-rule rounded-sm boa-mono text-[12px]"
              >
                <option value="WEEKLY">Weekly</option>
                <option value="BIWEEKLY">Every other week</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </Field>

            {form.frequency !== "MONTHLY" ? (
              <Field label="Day of week">
                <select
                  value={form.dayOfWeek}
                  onChange={(e) =>
                    setForm({ ...form, dayOfWeek: Number(e.target.value) })
                  }
                  className="w-full px-2 py-1.5 border boa-rule rounded-sm boa-mono text-[12px]"
                >
                  {DAYS_OF_WEEK.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Day of month (1–28)">
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={form.dayOfMonth}
                  onChange={(e) =>
                    setForm({ ...form, dayOfMonth: Number(e.target.value) })
                  }
                  className="w-full px-2 py-1.5 border boa-rule rounded-sm boa-mono text-[12px]"
                />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Hour (0–23)">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={form.hour}
                  onChange={(e) =>
                    setForm({ ...form, hour: Number(e.target.value) })
                  }
                  className="w-full px-2 py-1.5 border boa-rule rounded-sm boa-mono text-[12px]"
                />
              </Field>
              <Field label="Minute (0–59)">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={form.minute}
                  onChange={(e) =>
                    setForm({ ...form, minute: Number(e.target.value) })
                  }
                  className="w-full px-2 py-1.5 border boa-rule rounded-sm boa-mono text-[12px]"
                />
              </Field>
            </div>

            <Field label="Timezone">
              <select
                value={form.timezone}
                onChange={(e) =>
                  setForm({ ...form, timezone: e.target.value })
                }
                className="w-full px-2 py-1.5 border boa-rule rounded-sm boa-mono text-[12px]"
              >
                {[form.timezone, ...COMMON_TIMEZONES.filter((t) => t !== form.timezone)].map(
                  (tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ),
                )}
              </select>
            </Field>

            <Field label="Session mode">
              <select
                value={form.mode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mode: e.target.value as FormState["mode"],
                  })
                }
                className="w-full px-2 py-1.5 border boa-rule rounded-sm boa-mono text-[12px]"
              >
                <option value="ADVISORY">Advisory</option>
                <option value="BOARD">Board (vote)</option>
                <option value="REVIEW">Review</option>
              </select>
            </Field>

            <Field label="Question template">
              <textarea
                data-testid="input-cadence-question"
                value={form.questionTemplate}
                onChange={(e) =>
                  setForm({ ...form, questionTemplate: e.target.value })
                }
                rows={4}
                className="w-full px-2 py-1.5 border boa-rule rounded-sm boa-mono text-[12px]"
                placeholder="Use {{variable}} placeholders if needed"
              />
              <div
                className="boa-mono text-[10px] mt-1"
                style={{ color: "var(--boa-ink-3)" }}
              >
                Reference variables as <code>{"{{name}}"}</code>. Define them
                below.
              </div>
            </Field>

            <Field label="Template variables">
              <div className="space-y-1.5">
                {form.templateVariables.map((row, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      data-testid={`input-var-key-${i}`}
                      value={row.key}
                      onChange={(e) => {
                        const next = [...form.templateVariables];
                        next[i] = { ...row, key: e.target.value };
                        setForm({ ...form, templateVariables: next });
                      }}
                      placeholder="key"
                      className="w-1/3 px-2 py-1.5 border boa-rule rounded-sm boa-mono text-[12px]"
                    />
                    <input
                      data-testid={`input-var-val-${i}`}
                      value={row.value}
                      onChange={(e) => {
                        const next = [...form.templateVariables];
                        next[i] = { ...row, value: e.target.value };
                        setForm({ ...form, templateVariables: next });
                      }}
                      placeholder="value"
                      className="flex-1 px-2 py-1.5 border boa-rule rounded-sm boa-mono text-[12px]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = form.templateVariables.filter(
                          (_, idx) => idx !== i,
                        );
                        setForm({ ...form, templateVariables: next });
                      }}
                      className="p-1.5 rounded-sm hover:bg-[color:var(--boa-paper-2)]"
                      style={{ color: "var(--boa-ink-3)" }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  data-testid="button-add-var"
                  onClick={() =>
                    setForm({
                      ...form,
                      templateVariables: [
                        ...form.templateVariables,
                        { key: "", value: "" },
                      ],
                    })
                  }
                  className="boa-mono text-[10px] uppercase tracking-[0.18em] inline-flex items-center gap-1 px-2 py-1 border boa-rule rounded-sm hover:bg-[color:var(--boa-paper-2)]"
                  style={{ color: "var(--boa-ink-2)" }}
                >
                  <Plus className="w-3 h-3" /> Add variable
                </button>
              </div>
            </Field>

            <Field label="Digest recipients (comma-separated)">
              <textarea
                data-testid="input-cadence-recipients"
                value={form.recipients}
                onChange={(e) =>
                  setForm({ ...form, recipients: e.target.value })
                }
                rows={2}
                className="w-full px-2 py-1.5 border boa-rule rounded-sm boa-mono text-[12px]"
                placeholder="ceo@example.com, board@example.com"
              />
            </Field>

            <div className="flex items-center gap-2 pt-2">
              <button
                data-testid="button-save-cadence"
                onClick={handleSave}
                disabled={
                  !form.name.trim() ||
                  !form.questionTemplate.trim() ||
                  createMutation.isPending ||
                  updateMutation.isPending
                }
                className="boa-cta px-4 py-2 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                )}
                {form.id ? "Save changes" : "Create cadence"}
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="boa-mono text-[10px] uppercase tracking-[0.18em] px-3 py-2 border rounded-sm"
                style={{
                  borderColor: "var(--boa-ink-3)",
                  color: "var(--boa-ink-2)",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div
        className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-1"
        style={{ color: "var(--boa-ink-3)" }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

function CadenceHistory({ cadenceId }: { cadenceId: string }) {
  const { data, isLoading } = useListCadenceRuns(cadenceId);
  if (isLoading) {
    return (
      <div className="mt-3">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      </div>
    );
  }
  const runs = data ?? [];
  if (runs.length === 0) {
    return (
      <div
        className="mt-3 boa-mono text-[11px]"
        style={{ color: "var(--boa-ink-3)" }}
      >
        No runs yet
      </div>
    );
  }
  return (
    <div className="mt-3 border-t boa-rule pt-3 space-y-1.5">
      {runs.map((r) => (
        <div
          key={r.id}
          className="boa-mono text-[11px] flex items-center gap-3"
          style={{ color: "var(--boa-ink-2)" }}
          data-testid={`cadence-run-${r.id}`}
        >
          <span
            className="px-1.5 py-0.5 rounded-sm uppercase tracking-wider text-[9px]"
            style={{
              background:
                r.status === "complete"
                  ? "var(--boa-vote-yes-soft, #d4e9c5)"
                  : r.status === "failed"
                    ? "var(--boa-vote-no-soft, #f0d4d4)"
                    : "var(--boa-paper-3)",
              color:
                r.status === "complete"
                  ? "var(--boa-vote-yes, #3a6b1a)"
                  : r.status === "failed"
                    ? "var(--boa-vote-no, #8b1f1f)"
                    : "var(--boa-ink)",
            }}
          >
            {r.status}
          </span>
          <span>
            {new Date(r.startedAt).toLocaleString([], {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
          {r.deliveryStatus && (
            <span style={{ color: "var(--boa-ink-3)" }}>
              digest: {r.deliveryStatus}
            </span>
          )}
          {r.errorDetail && (
            <span
              className="truncate"
              style={{ color: "var(--boa-vote-no)" }}
              title={r.errorDetail}
            >
              {r.errorDetail}
            </span>
          )}
          {r.sessionId && (
            <Link
              className="underline"
              style={{ color: "var(--boa-brass)" }}
              href={`/sessions/${r.sessionId}`}
              data-testid={`link-session-${r.sessionId}`}
            >
              session
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
