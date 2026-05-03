import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  useGetBoard,
  useUpdateBoard,
  useDeleteBoardMember,
  useCreateBoardMember,
  useListBoardDecisions,
  type Decision,
} from "@workspace/api-client-react";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, Play, Plus, Trash2, Edit, Users, Scale, Library, Rss, Copy } from "lucide-react";
import { GroundingSelectorList } from "@/components/GroundingSelectorList";
import { DecisionRow, OutcomeDrawer } from "./Decisions";
import BoardIntelligence from "./BoardIntelligence";
import { AdvisorLibrary } from "@/components/AdvisorLibrary";
import CadencePanel from "@/components/CadencePanel";
import { getBoardAudioFeedUrl } from "@workspace/api-client-react";

export default function BoardDetail({ tenantId, boardId }: { tenantId: string; boardId: string }) {
  const { data: boardDetail, isLoading, refetch } = useGetBoard(boardId);
  const updateBoard = useUpdateBoard();
  const deleteMember = useDeleteBoardMember();
  const createMember = useCreateBoardMember();
  const { toast } = useToast();

  const [instructions, setInstructions] = useState("");
  const { data: decisions, refetch: refetchDecisions } = useListBoardDecisions(boardId);
  const [drawerDecision, setDrawerDecision] = useState<Decision | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const updateRef = useRef(updateBoard.mutate);
  updateRef.current = updateBoard.mutate;

  useEffect(() => {
    if (boardDetail) setInstructions(boardDetail.masterInstructionsText);
  }, [boardDetail?.id]);

  const handleSaveInstructions = () => {
    updateRef.current(
      { boardId, data: { masterInstructionsText: instructions } },
      {
        onSuccess: () => {
          toast({ title: "Instructions saved" });
          refetch();
        },
        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleAddQuickMember = async () => {
    const idx = (boardDetail?.members?.length || 0) + 1;
    try {
      await createMember.mutateAsync({
        boardId,
        data: { name: `Advisor ${idx}`, roleTitle: "Board Member" },
      });
      refetch();
    } catch {}
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm("Remove this advisor?")) return;
    try {
      await deleteMember.mutateAsync({ memberId });
      refetch();
    } catch {}
  };

  if (isLoading)
    return (
      <div className="max-w-[1200px] mx-auto px-8 py-10">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--boa-brass)" }} />
      </div>
    );
  if (!boardDetail) return <div className="px-8 py-10">Not found</div>;

  return (
    <div className="max-w-[1200px] mx-auto px-8 py-10">
      <Link
        href={`/t/${tenantId}/boards`}
        className="inline-flex items-center text-[12px] mb-6 boa-mono uppercase tracking-[0.15em] hover:underline"
        style={{ color: "var(--boa-ink-3)" }}
      >
        <ChevronLeft className="w-3.5 h-3.5 mr-1" />
        Back to boards
      </Link>

      <header className="mb-10 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <div
            className="boa-mono text-[11px] uppercase tracking-[0.18em] mb-3"
            style={{ color: "var(--boa-brass)" }}
          >
            Board · {boardDetail.topicArea || "General"}
          </div>
          <h1 className="boa-display text-[42px] leading-tight" style={{ color: "var(--boa-ink)" }}>
            {boardDetail.name}
          </h1>
          {boardDetail.description && (
            <p className="text-[14px] mt-2 max-w-2xl" style={{ color: "var(--boa-ink-2)" }}>
              {boardDetail.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PodcastSubscribeButton boardId={boardId} />
          <Link href={`/t/${tenantId}/boards/${boardId}/run`}>
            <button className="boa-cta-brass px-4 py-2.5 rounded-sm text-[13px] flex items-center gap-2 font-medium">
              <Play className="w-3.5 h-3.5" fill="currentColor" />
              Convene session
            </button>
          </Link>
        </div>
      </header>

      <Tabs defaultValue="members">
        <TabsList className="mb-6 bg-transparent border-b boa-rule rounded-none w-full justify-start p-0 h-auto">
          <TabsTrigger
            value="members"
            className="boa-mono text-[10px] uppercase tracking-[0.18em] data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[var(--boa-ink)] data-[state=active]:text-[var(--boa-ink)] rounded-none px-4 py-2.5"
          >
            Members ({boardDetail.members.length}/{boardDetail.size})
          </TabsTrigger>
          <TabsTrigger
            value="decisions"
            className="boa-mono text-[10px] uppercase tracking-[0.18em] data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[var(--boa-ink)] data-[state=active]:text-[var(--boa-ink)] rounded-none px-4 py-2.5"
          >
            Decisions ({decisions?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger
            value="intelligence"
            className="boa-mono text-[10px] uppercase tracking-[0.18em] data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[var(--boa-ink)] data-[state=active]:text-[var(--boa-ink)] rounded-none px-4 py-2.5"
          >
            Intelligence
          </TabsTrigger>
          <TabsTrigger
            value="instructions"
            className="boa-mono text-[10px] uppercase tracking-[0.18em] data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[var(--boa-ink)] data-[state=active]:text-[var(--boa-ink)] rounded-none px-4 py-2.5"
          >
            Master instructions
          </TabsTrigger>
          <TabsTrigger
            value="grounding"
            className="boa-mono text-[10px] uppercase tracking-[0.18em] data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[var(--boa-ink)] data-[state=active]:text-[var(--boa-ink)] rounded-none px-4 py-2.5"
          >
            Live grounding
          </TabsTrigger>
          <TabsTrigger
            value="cadence"
            data-testid="tab-cadence"
            className="boa-mono text-[10px] uppercase tracking-[0.18em] data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-[var(--boa-ink)] data-[state=active]:text-[var(--boa-ink)] rounded-none px-4 py-2.5"
          >
            Cadence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <h2 className="boa-display text-[22px]">Council roster</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLibraryOpen(true)}
                disabled={boardDetail.members.length >= boardDetail.size}
                data-testid="open-advisor-library"
                className="boa-cta-brass inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[12px] font-medium disabled:opacity-40"
              >
                <Library className="w-3.5 h-3.5" /> Seat from library
              </button>
              <button
                onClick={handleAddQuickMember}
                disabled={boardDetail.members.length >= boardDetail.size}
                className="inline-flex items-center gap-1.5 boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1.5 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors disabled:opacity-40"
                style={{ borderColor: "var(--boa-ink)", color: "var(--boa-ink)" }}
              >
                <Plus className="w-3 h-3" /> Add blank
              </button>
            </div>
          </div>

          <div className="border-t border-b boa-rule-strong divide-y boa-rule">
            {boardDetail.members.map((m) => (
              <div key={m.id} className="py-4 flex items-center gap-4">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center boa-mono text-[10px]"
                  style={{ background: "var(--boa-paper-3)", color: "var(--boa-ink)" }}
                >
                  {(m.name || "??").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="boa-display text-[16px]" style={{ color: "var(--boa-ink)" }}>
                    {m.name}
                  </div>
                  <div
                    className="boa-mono text-[10px] uppercase tracking-wider"
                    style={{ color: "var(--boa-ink-3)" }}
                  >
                    {m.roleTitle}
                  </div>
                </div>
                {m.modelOverride && (
                  <span
                    className="boa-mono text-[10px] px-1.5 py-0.5 rounded-sm"
                    style={{ background: "var(--boa-paper-2)", color: "var(--boa-ink-3)" }}
                  >
                    {m.modelOverride}
                  </span>
                )}
                <Link href={`/t/${tenantId}/boards/${boardId}/members/${m.id}`}>
                  <button
                    className="p-1.5 rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
                    style={{ color: "var(--boa-ink-2)" }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                </Link>
                <button
                  onClick={() => handleDeleteMember(m.id)}
                  className="p-1.5 rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
                  style={{ color: "var(--boa-vote-no)" }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {boardDetail.members.length === 0 && (
              <div className="py-12 text-center" style={{ color: "var(--boa-ink-3)" }}>
                <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <div className="boa-mono text-[10px] uppercase tracking-[0.18em]">
                  No advisors seated
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="decisions">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="boa-display text-[22px]">Decision ledger</h2>
            </div>
            {!decisions?.length ? (
              <div
                className="border boa-rule rounded-sm p-10 text-center"
                style={{ color: "var(--boa-ink-3)" }}
              >
                <Scale className="w-6 h-6 mx-auto mb-3 opacity-40" />
                <div className="boa-mono text-[10px] uppercase tracking-[0.18em] mb-2">
                  No decisions yet
                </div>
                <p className="text-[13px]">
                  Convene a Board-vote session and decisions will appear here automatically.
                </p>
              </div>
            ) : (
              <div className="border-t border-b boa-rule-strong divide-y boa-rule">
                {decisions.map((d) => (
                  <DecisionRow
                    key={d.id}
                    decision={d}
                    showBoard={false}
                    onRecord={() => setDrawerDecision(d)}
                  />
                ))}
              </div>
            )}
          </div>
          <OutcomeDrawer
            decision={drawerDecision}
            onClose={() => setDrawerDecision(null)}
            onSaved={() => {
              setDrawerDecision(null);
              refetchDecisions();
            }}
          />
        </TabsContent>

        <TabsContent value="intelligence">
          <BoardIntelligence tenantId={tenantId} boardId={boardId} />
        </TabsContent>

        <TabsContent value="instructions">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="boa-display text-[22px]">Master instructions</h2>
              <span
                className="boa-mono text-[10px]"
                style={{
                  color:
                    instructions.length > 7500 ? "var(--boa-vote-no)" : "var(--boa-ink-3)",
                }}
              >
                {instructions.length} / 7500
              </span>
            </div>
            <p className="text-[13px] max-w-2xl" style={{ color: "var(--boa-ink-2)" }}>
              These instructions frame the chair and every member. They apply to all sessions on this
              board.
            </p>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="min-h-[400px] boa-mono text-[12.5px]"
              placeholder="You convene the Capital Allocation Council. Members deliberate on…"
            />
            <button
              onClick={handleSaveInstructions}
              disabled={updateBoard.isPending}
              className="boa-cta px-4 py-2 rounded-sm text-[13px] font-medium inline-flex items-center disabled:opacity-50"
            >
              {updateBoard.isPending && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
              Save instructions
            </button>
          </div>
        </TabsContent>

        <TabsContent value="grounding" className="space-y-4">
          <h2 className="boa-display text-[22px]">Live grounding selectors</h2>
          <GroundingSelectorList
            tenantId={tenantId}
            scope={{ boardId }}
          />
        </TabsContent>

        <TabsContent value="cadence">
          <CadencePanel boardId={boardId} />
        </TabsContent>
      </Tabs>

      <AdvisorLibrary
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        boardId={boardId}
        seatedRoleTitles={boardDetail.members.map((m) => m.roleTitle)}
        capacityLeft={boardDetail.size - boardDetail.members.length}
        onSeated={() => refetch()}
      />
    </div>
  );
}

function PodcastSubscribeButton({ boardId }: { boardId: string }) {
  const { toast } = useToast();

  const fetchFeedUrl = async (): Promise<string> => {
    const r = await getBoardAudioFeedUrl(boardId);
    return r.feedUrl;
  };

  const opmlBlob = async () => {
    let feedUrl: string;
    try {
      feedUrl = await fetchFeedUrl();
    } catch {
      toast({ title: "Could not generate feed link", variant: "destructive" });
      return;
    }
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Quorum board feed</title></head>
  <body>
    <outline type="rss" text="Quorum board" xmlUrl="${feedUrl}" />
  </body>
</opml>`;
    const blob = new Blob([xml], { type: "text/x-opml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quorum-board-${boardId.slice(0, 8)}.opml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try {
      const feedUrl = await fetchFeedUrl();
      await navigator.clipboard.writeText(feedUrl);
      toast({
        title: "RSS feed URL copied",
        description: "Paste into Apple Podcasts, Overcast, Spotify, etc.",
      });
    } catch (e) {
      toast({
        title: "Could not copy feed URL",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={copy}
        title="Copy RSS feed URL"
        className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-2 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors inline-flex items-center gap-1.5"
        style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
      >
        <Rss className="w-3 h-3" />
        Subscribe in podcast app
        <Copy className="w-3 h-3 opacity-60" />
      </button>
      <button
        onClick={opmlBlob}
        title="Download OPML"
        className="boa-mono text-[10px] uppercase tracking-[0.18em] px-2 py-2 border rounded-sm hover:bg-[color:var(--boa-paper-2)] transition-colors"
        style={{ borderColor: "var(--boa-paper-3)", color: "var(--boa-ink-2)" }}
      >
        OPML
      </button>
    </div>
  );
}
