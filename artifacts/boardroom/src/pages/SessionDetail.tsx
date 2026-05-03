import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useGetSession, SessionStatus, SessionMode, Vote } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2, User, HelpCircle, Check, X, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface StreamEvent {
  phase: 'framing' | 'member_started' | 'member_done' | 'convergence' | 'complete';
  memberName?: string;
  memberRoleTitle?: string;
  contributionText?: string;
  vote?: Vote;
  establishedFactsText?: string;
  chairsFraming?: string;
  convergenceNote?: string;
  finalSummary?: string;
  openQuestionsText?: string;
  flagsRaisedText?: string;
  voteTable?: any[];
}

export default function SessionDetail({ sessionId }: { sessionId: string }) {
  const { data: sessionData, isLoading, refetch } = useGetSession(sessionId);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeMember, setActiveMember] = useState<string | null>(null);

  const isLive = sessionData?.session.status === SessionStatus.running;

  useEffect(() => {
    if (!isLive) return;

    setIsStreaming(true);
    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`, { 
      withCredentials: true 
    });

    eventSource.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data) as StreamEvent;
        
        if (data.phase === 'member_started') {
          setActiveMember(data.memberName || null);
        } else if (data.phase === 'member_done') {
          setActiveMember(null);
          setStreamEvents(prev => [...prev, data]);
        } else {
          setStreamEvents(prev => [...prev, data]);
        }
      } catch (err) {
        console.error("Error parsing stream data", err);
      }
    });

    eventSource.addEventListener('done', () => {
      setIsStreaming(false);
      setActiveMember(null);
      eventSource.close();
      refetch(); // Get final structured data
    });

    eventSource.addEventListener('error', () => {
      setIsStreaming(false);
      setActiveMember(null);
      eventSource.close();
      refetch();
    });

    return () => {
      eventSource.close();
    };
  }, [sessionId, isLive, refetch]);

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!sessionData) return <div>Session not found</div>;

  const { session, board, contributions, summary, establishedFactsText } = sessionData;
  const isBoardMode = session.mode === SessionMode.BOARD;

  // Combine historical contributions with live stream events if running
  const displayContributions = isLive 
    ? streamEvents.filter(e => e.phase === 'member_done') 
    : contributions;

  const framingEvent = streamEvents.find(e => e.phase === 'framing');
  const convergenceEvent = streamEvents.find(e => e.phase === 'convergence');
  
  const framingText = isLive ? framingEvent?.chairsFraming : summary?.chairsFraming;
  const factsText = isLive ? framingEvent?.establishedFactsText : establishedFactsText;
  const convergenceText = isLive ? convergenceEvent?.convergenceNote : summary?.convergenceNote;
  const openQuestions = isLive ? convergenceEvent?.openQuestionsText : summary?.openQuestionsText;

  const renderVoteIcon = (vote?: Vote | null) => {
    if (!vote) return null;
    switch (vote) {
      case 'YES': return <Check className="w-4 h-4 text-emerald-500" />;
      case 'NO': return <X className="w-4 h-4 text-destructive" />;
      case 'ABSTAIN': return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const renderVoteBadge = (vote?: Vote | null) => {
    if (!vote) return null;
    switch (vote) {
      case 'YES': return <span className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-xs font-medium border border-emerald-500/20">YES</span>;
      case 'NO': return <span className="bg-destructive/10 text-destructive px-2 py-0.5 rounded text-xs font-medium border border-destructive/20">NO</span>;
      case 'ABSTAIN': return <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded text-xs font-medium border border-border">ABSTAIN</span>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <Link href={`/t/${board.tenantId}/boards/${board.id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Board
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-medium px-2 py-1 rounded-md bg-secondary/10 text-secondary border border-secondary/20">
                {session.mode}
              </span>
              {isLive && (
                <span className="flex items-center text-xs font-medium px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-primary mr-1.5" />
                  Live
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{session.questionText}</h1>
          </div>
        </div>
      </div>

      {/* Framing Phase */}
      {(framingText || factsText) && (
        <Card className="bg-card/50 border-white/5 shadow-md">
          <CardHeader className="pb-3 border-b border-border/50 bg-muted/20 rounded-t-xl">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary mr-3">
                <User className="w-4 h-4" />
              </div>
              <div>
                <CardTitle className="text-base">Chair's Framing</CardTitle>
                <CardDescription className="text-xs">Setting the stage for deliberation</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {framingText && (
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap">
                {framingText}
              </div>
            )}
            {factsText && (
              <div className="bg-background/50 rounded-lg p-4 border border-border">
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <HelpCircle className="w-4 h-4 mr-1.5 text-muted-foreground" />
                  Established Facts
                </h4>
                <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                  {factsText}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contributions */}
      <div className="space-y-6 pl-4 border-l-2 border-border/50 ml-4">
        <AnimatePresence initial={false}>
          {displayContributions.map((contrib, i) => (
            <motion.div
              key={(contrib as any).id || i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="absolute -left-[27px] top-4 w-3 h-3 rounded-full bg-border border-4 border-background" />
              <Card className="bg-card/80 border-white/5 shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                  <div className="flex items-center">
                    <div>
                      <CardTitle className="text-base font-semibold">{contrib.memberName || 'Advisor'}</CardTitle>
                      <CardDescription className="text-xs font-medium">{contrib.memberRoleTitle}</CardDescription>
                    </div>
                  </div>
                  {isBoardMode && renderVoteBadge(contrib.vote)}
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap">
                    {contrib.contributionText || ""}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Live Active Member Indicator */}
        {activeMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative"
          >
            <div className="absolute -left-[27px] top-4 w-3 h-3 rounded-full bg-primary border-4 border-background animate-pulse" />
            <div className="flex items-center gap-3 py-3 px-4 rounded-xl border border-primary/20 bg-primary/5 w-fit">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-sm font-medium text-primary">{activeMember} is deliberating...</span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Convergence Phase */}
      {convergenceText && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-card/50 border-white/5 shadow-md mt-12 overflow-hidden">
            <div className="page-header-gradient-bar" />
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mr-3">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Chair's Convergence</CardTitle>
                  <CardDescription className="text-xs">Summary of the deliberation</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              
              {/* Vote Table if Board Mode */}
              {isBoardMode && (
                <div className="bg-background rounded-lg border border-border overflow-hidden mb-6">
                  <div className="bg-muted/50 px-4 py-2 border-b border-border font-medium text-sm flex justify-between">
                    <span>Vote Tally</span>
                    {/* Simple count logic for completed session data */}
                    {!isLive && contributions && (
                      <span className="text-muted-foreground font-normal">
                        Yes: {contributions.filter(c => c.vote === 'YES').length} / 
                        No: {contributions.filter(c => c.vote === 'NO').length} / 
                        Abstain: {contributions.filter(c => c.vote === 'ABSTAIN').length}
                      </span>
                    )}
                  </div>
                  <div className="divide-y divide-border">
                    {displayContributions.map((c, i) => (
                      <div key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                        <span>{c.memberName}</span>
                        <div className="flex items-center gap-2">
                          {renderVoteBadge(c.vote)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/90 whitespace-pre-wrap">
                {convergenceText}
              </div>

              {openQuestions && (
                <div className="mt-6 pt-6 border-t border-border/50">
                  <h4 className="text-sm font-medium mb-3">Open Questions for Human Review</h4>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap">
                    {openQuestions}
                  </div>
                </div>
              )}
            </CardContent>
            
            {/* Cost footer if complete */}
            {!isLive && session.totalCostCents !== undefined && session.totalCostCents !== null && (
              <div className="px-6 py-3 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground flex justify-end">
                Session compute cost: ${(session.totalCostCents / 100).toFixed(4)}
              </div>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  );
}