import { useState, useMemo } from "react";
import {
  useListAdvisorPresets,
  useSeatAdvisorPreset,
  useListRosterAdvisors,
  useSeatRosterAdvisor,
  type RosterAdvisor,
} from "@workspace/api-client-react";
import type { AdvisorPreset, PresetCategory } from "@workspace/api-client-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Search, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_LABELS: Record<PresetCategory | "all", string> = {
  all: "All",
  strategy: "Strategy",
  capital: "Capital",
  operations: "Operations",
  product: "Product",
  risk: "Risk",
  people: "People",
};

const KIND_LABELS = {
  archetype: "Archetype",
  specialist: "Specialist",
  famous: "In-the-style-of",
} as const;

export function AdvisorLibrary({
  open,
  onOpenChange,
  tenantId,
  boardId,
  seatedRoleTitles,
  onSeated,
  capacityLeft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  boardId: string;
  seatedRoleTitles: string[];
  onSeated: () => void;
  capacityLeft: number;
}) {
  const { data: presets, isLoading } = useListAdvisorPresets();
  const seatPreset = useSeatAdvisorPreset();
  const seatRoster = useSeatRosterAdvisor();
  const { data: rosterAdvisors = [], isLoading: rosterLoading } = useListRosterAdvisors(
    { tenantId },
  );
  const { toast } = useToast();

  const [tab, setTab] = useState<"library" | "roster">("library");
  const [category, setCategory] = useState<PresetCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [recentlySeated, setRecentlySeated] = useState<string[]>([]);
  const [rosterSearch, setRosterSearch] = useState("");
  const [selectedRosterId, setSelectedRosterId] = useState<string | null>(null);
  const [recentlySeatedRoster, setRecentlySeatedRoster] = useState<string[]>([]);

  const filtered = useMemo(() => {
    if (!presets) return [];
    const q = search.trim().toLowerCase();
    return presets.filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.roleTitle.toLowerCase().includes(q) ||
        p.lensDescription.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [presets, category, search]);

  const filteredRoster = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    if (!q) return rosterAdvisors;
    return rosterAdvisors.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.roleTitle.toLowerCase().includes(q) ||
        (a.lensDescription ?? "").toLowerCase().includes(q),
    );
  }, [rosterAdvisors, rosterSearch]);

  const selected = useMemo(
    () => presets?.find((p) => p.slug === selectedSlug) ?? null,
    [presets, selectedSlug],
  );

  const selectedRoster = useMemo(
    () => rosterAdvisors.find((a) => a.id === selectedRosterId) ?? null,
    [rosterAdvisors, selectedRosterId],
  );

  const seatedSet = useMemo(
    () => new Set(seatedRoleTitles.map((r) => r.toLowerCase())),
    [seatedRoleTitles],
  );

  const handleSeat = async (preset: AdvisorPreset) => {
    if (capacityLeft - recentlySeated.length <= 0) {
      toast({
        title: "Board is full",
        description: "Increase the board size to seat more advisors.",
        variant: "destructive",
      });
      return;
    }
    try {
      await seatPreset.mutateAsync({
        boardId,
        data: { presetSlug: preset.slug },
      });
      setRecentlySeated((p) => [...p, preset.slug]);
      toast({ title: `${preset.name} seated` });
      onSeated();
    } catch (err) {
      toast({
        title: "Failed to seat advisor",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleSeatRoster = async (advisor: RosterAdvisor) => {
    if (capacityLeft - recentlySeated.length - recentlySeatedRoster.length <= 0) {
      toast({
        title: "Board is full",
        description: "Increase the board size to seat more advisors.",
        variant: "destructive",
      });
      return;
    }
    try {
      await seatRoster.mutateAsync({
        boardId,
        data: { rosterAdvisorId: advisor.id },
      });
      setRecentlySeatedRoster((p) => [...p, advisor.id]);
      toast({ title: `${advisor.name} seated` });
      onSeated();
    } catch (err) {
      toast({
        title: "Failed to seat advisor",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setSearch("");
      setSelectedSlug(null);
      setRecentlySeated([]);
      setRosterSearch("");
      setSelectedRosterId(null);
      setRecentlySeatedRoster([]);
    }
    onOpenChange(next);
  };

  const remaining = capacityLeft - recentlySeated.length - recentlySeatedRoster.length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="boa max-w-[1100px] w-[95vw] h-[85vh] p-0 overflow-hidden flex flex-col gap-0"
        style={{ background: "var(--boa-paper)", color: "var(--boa-ink)" }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b boa-rule-strong flex items-center justify-between"
          style={{ background: "var(--boa-paper-2)" }}
        >
          <div className="flex items-center gap-6">
            <div>
              <div
                className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-0.5"
                style={{ color: "var(--boa-brass)" }}
              >
                Seat advisor
              </div>
              <div className="flex gap-1 mt-2">
                {(["library", "roster"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="px-3 py-1 rounded-sm text-[12px] transition-colors"
                    style={{
                      background: tab === t ? "var(--boa-paper-3)" : "transparent",
                      color: tab === t ? "var(--boa-ink)" : "var(--boa-ink-3)",
                      fontWeight: tab === t ? 600 : 400,
                    }}
                  >
                    {t === "library" ? "Curated Library" : "My Roster"}
                    {t === "roster" && rosterAdvisors.length > 0 && (
                      <span
                        className="ml-1.5 boa-mono text-[10px]"
                        style={{ color: "var(--boa-brass)" }}
                      >
                        {rosterAdvisors.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span
              className="boa-mono text-[10px] uppercase tracking-[0.18em]"
              style={{ color: "var(--boa-ink-3)" }}
            >
              {remaining} seat{remaining === 1 ? "" : "s"} remaining
            </span>
            <button
              onClick={() => handleClose(false)}
              className="p-1.5 rounded-sm hover:bg-[color:var(--boa-paper-3)]"
              style={{ color: "var(--boa-ink-2)" }}
              aria-label="Close library"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {tab === "roster" ? (
          /* ── My Roster tab ── */
          <div className="flex-1 flex min-h-0">
            {/* Roster list */}
            <div className="w-[400px] border-r boa-rule shrink-0 flex flex-col min-h-0">
              <div className="p-3 border-b boa-rule">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                    style={{ color: "var(--boa-ink-3)" }}
                  />
                  <Input
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    placeholder="Search roster…"
                    className="pl-9 text-[13px]"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {rosterLoading ? (
                  <div className="p-8 text-center">
                    <Loader2
                      className="w-4 h-4 animate-spin mx-auto"
                      style={{ color: "var(--boa-brass)" }}
                    />
                  </div>
                ) : filteredRoster.length === 0 ? (
                  <div
                    className="p-8 text-center boa-mono text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    {rosterAdvisors.length === 0
                      ? "No advisors in roster yet — add them in Advisor Roster"
                      : "No matches"}
                  </div>
                ) : (
                  filteredRoster.map((a) => {
                    const isSelected = a.id === selectedRosterId;
                    const isSeated = recentlySeatedRoster.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedRosterId(a.id)}
                        className="w-full text-left px-4 py-3 border-b boa-rule transition-colors"
                        style={{
                          background: isSelected
                            ? "var(--boa-paper-3)"
                            : "transparent",
                        }}
                      >
                        <div className="flex items-baseline justify-between gap-2 mb-0.5">
                          <span
                            className="boa-display text-[15px]"
                            style={{ color: "var(--boa-ink)" }}
                          >
                            {a.name}
                          </span>
                          {isSeated && (
                            <Check
                              className="w-3 h-3 shrink-0"
                              style={{ color: "var(--boa-vote-yes)" }}
                            />
                          )}
                        </div>
                        <div
                          className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-1"
                          style={{ color: "var(--boa-ink-3)" }}
                        >
                          {a.roleTitle}
                        </div>
                        <div className="flex items-center gap-2">
                          {a.groundingDocument ? (
                            <span
                              className="boa-mono text-[10px]"
                              style={{ color: "var(--boa-vote-yes)" }}
                            >
                              ● doc attached
                            </span>
                          ) : (
                            <span
                              className="boa-mono text-[10px]"
                              style={{ color: "var(--boa-brass)" }}
                            >
                              ○ no document
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Roster detail */}
            <div className="flex-1 overflow-y-auto">
              {selectedRoster ? (
                <div className="p-8">
                  <h3
                    className="boa-display text-[30px] leading-tight mb-1"
                    style={{ color: "var(--boa-ink)" }}
                  >
                    {selectedRoster.name}
                  </h3>
                  <div
                    className="boa-mono text-[11px] uppercase tracking-[0.18em] mb-5"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    {selectedRoster.roleTitle}
                  </div>
                  {selectedRoster.lensDescription && (
                    <p
                      className="text-[14px] mb-6 leading-relaxed"
                      style={{ color: "var(--boa-ink-2)" }}
                    >
                      {selectedRoster.lensDescription}
                    </p>
                  )}
                  {selectedRoster.groundingDocument && (
                    <div
                      className="mb-6 px-3 py-2 rounded-sm border inline-flex items-center gap-2 text-[12px]"
                      style={{
                        borderColor: "var(--boa-paper-3)",
                        color: "var(--boa-ink-2)",
                      }}
                    >
                      <span style={{ color: "var(--boa-vote-yes)" }}>●</span>
                      {selectedRoster.groundingDocument.filename}
                      <span
                        className="boa-mono text-[10px]"
                        style={{ color: "var(--boa-ink-3)" }}
                      >
                        {selectedRoster.groundingDocument.characterCount.toLocaleString()} chars
                      </span>
                    </div>
                  )}
                  <div className="mb-6">
                    <button
                      onClick={() => handleSeatRoster(selectedRoster)}
                      disabled={seatRoster.isPending || remaining <= 0}
                      className="boa-cta-brass px-4 py-2.5 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
                    >
                      {seatRoster.isPending && (
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                      )}
                      {recentlySeatedRoster.includes(selectedRoster.id) && !seatRoster.isPending
                        ? "Seat again"
                        : "Seat on this board"}
                    </button>
                    {remaining <= 0 && (
                      <span
                        className="ml-3 boa-mono text-[10px] uppercase tracking-[0.18em]"
                        style={{ color: "var(--boa-vote-no)" }}
                      >
                        Board is full
                      </span>
                    )}
                  </div>
                  {selectedRoster.instructionsText && (
                    <div className="border-t boa-rule pt-5">
                      <div
                        className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-3"
                        style={{ color: "var(--boa-ink-3)" }}
                      >
                        Instructions (preview)
                      </div>
                      <pre
                        className="boa-mono text-[11.5px] whitespace-pre-wrap leading-relaxed p-4 rounded-sm border"
                        style={{
                          background: "var(--boa-paper-2)",
                          borderColor: "var(--boa-paper-3)",
                          color: "var(--boa-ink-2)",
                        }}
                      >
                        {selectedRoster.instructionsText}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="h-full flex items-center justify-center boa-mono text-[10px] uppercase tracking-[0.18em] p-8 text-center"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  Select an advisor to preview
                </div>
              )}
            </div>
          </div>
        ) : (

        /* ── Library tab (original) ── */
        <div className="flex-1 flex min-h-0">
          {/* Sidebar */}
          <aside
            className="w-[200px] border-r boa-rule shrink-0 py-4 px-3 overflow-y-auto"
            style={{ background: "var(--boa-paper-2)" }}
          >
            <div
              className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2 mb-2"
              style={{ color: "var(--boa-ink-3)" }}
            >
              Categories
            </div>
            {(Object.keys(CATEGORY_LABELS) as (PresetCategory | "all")[]).map(
              (c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  data-testid={`category-${c}`}
                  className={`w-full text-left px-2 py-1.5 text-[12.5px] rounded-sm transition-colors ${
                    category === c
                      ? "font-medium"
                      : "hover:bg-[color:var(--boa-paper-3)]"
                  }`}
                  style={{
                    background:
                      category === c ? "var(--boa-paper-3)" : "transparent",
                    color:
                      category === c ? "var(--boa-ink)" : "var(--boa-ink-2)",
                  }}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ),
            )}
          </aside>

          {/* List */}
          <div
            className="w-[400px] border-r boa-rule shrink-0 flex flex-col min-h-0"
          >
            <div className="p-3 border-b boa-rule">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
                  style={{ color: "var(--boa-ink-3)" }}
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, lens, or tag…"
                  className="pl-9 text-[13px]"
                  data-testid="advisor-search"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center">
                  <Loader2
                    className="w-4 h-4 animate-spin mx-auto"
                    style={{ color: "var(--boa-brass)" }}
                  />
                </div>
              ) : filtered.length === 0 ? (
                <div
                  className="p-8 text-center boa-mono text-[10px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--boa-ink-3)" }}
                >
                  No matches
                </div>
              ) : (
                filtered.map((p) => {
                  const isSelected = p.slug === selectedSlug;
                  const isSeated =
                    recentlySeated.includes(p.slug) ||
                    seatedSet.has(p.roleTitle.toLowerCase());
                  return (
                    <button
                      key={p.slug}
                      onClick={() => setSelectedSlug(p.slug)}
                      data-testid={`preset-${p.slug}`}
                      className="w-full text-left px-4 py-3 border-b boa-rule transition-colors"
                      style={{
                        background: isSelected
                          ? "var(--boa-paper-3)"
                          : "transparent",
                      }}
                    >
                      <div className="flex items-baseline justify-between gap-2 mb-0.5">
                        <span
                          className="boa-display text-[15px]"
                          style={{ color: "var(--boa-ink)" }}
                        >
                          {p.name}
                        </span>
                        {isSeated && (
                          <Check
                            className="w-3 h-3 shrink-0"
                            style={{ color: "var(--boa-vote-yes)" }}
                          />
                        )}
                      </div>
                      <div
                        className="boa-mono text-[10px] uppercase tracking-[0.15em] mb-1"
                        style={{ color: "var(--boa-ink-3)" }}
                      >
                        {p.roleTitle}
                      </div>
                      <div
                        className="text-[12px] line-clamp-2"
                        style={{ color: "var(--boa-ink-2)" }}
                      >
                        {p.lensDescription}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Detail */}
          <div className="flex-1 overflow-y-auto">
            {selected ? (
              <PresetDetail
                preset={selected}
                onSeat={() => handleSeat(selected)}
                isPending={seatPreset.isPending}
                disabled={remaining <= 0}
                seated={
                  recentlySeated.includes(selected.slug) ||
                  seatedSet.has(selected.roleTitle.toLowerCase())
                }
              />
            ) : (
              <div
                className="h-full flex items-center justify-center boa-mono text-[10px] uppercase tracking-[0.18em] p-8 text-center"
                style={{ color: "var(--boa-ink-3)" }}
              >
                Select a persona to preview
              </div>
            )}
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PresetDetail({
  preset,
  onSeat,
  isPending,
  disabled,
  seated,
}: {
  preset: AdvisorPreset;
  onSeat: () => void;
  isPending: boolean;
  disabled: boolean;
  seated: boolean;
}) {
  return (
    <div className="p-8">
      <div
        className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-3"
        style={{ color: "var(--boa-brass)" }}
      >
        {KIND_LABELS[preset.kind]} · {CATEGORY_LABELS[preset.category]}
      </div>
      <h3
        className="boa-display text-[30px] leading-tight mb-1"
        style={{ color: "var(--boa-ink)" }}
      >
        {preset.name}
      </h3>
      <div
        className="boa-mono text-[11px] uppercase tracking-[0.18em] mb-5"
        style={{ color: "var(--boa-ink-3)" }}
      >
        {preset.roleTitle}
      </div>

      <p
        className="text-[14px] mb-6 leading-relaxed"
        style={{ color: "var(--boa-ink-2)" }}
      >
        {preset.lensDescription}
      </p>

      {preset.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {preset.tags.map((t) => (
            <span
              key={t}
              className="boa-mono text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-sm border"
              style={{
                borderColor: "var(--boa-paper-3)",
                color: "var(--boa-ink-3)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={onSeat}
          disabled={isPending || disabled}
          data-testid="seat-preset"
          className="boa-cta-brass px-4 py-2.5 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
          {seated && !isPending ? "Seat again" : "Seat on this board"}
        </button>
        {disabled && (
          <span
            className="ml-3 boa-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--boa-vote-no)" }}
          >
            Board is full
          </span>
        )}
      </div>

      <div
        className="border-t boa-rule pt-5"
      >
        <div
          className="boa-mono text-[10px] uppercase tracking-[0.2em] mb-3"
          style={{ color: "var(--boa-ink-3)" }}
        >
          Full instructions (preview)
        </div>
        <pre
          className="boa-mono text-[11.5px] whitespace-pre-wrap leading-relaxed p-4 rounded-sm border"
          style={{
            background: "var(--boa-paper-2)",
            borderColor: "var(--boa-paper-3)",
            color: "var(--boa-ink-2)",
          }}
        >
          {preset.instructionsText}
        </pre>
      </div>
    </div>
  );
}
