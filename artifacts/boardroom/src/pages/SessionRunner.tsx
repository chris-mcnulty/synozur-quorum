import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useGetBoard, useCreateSession, SessionMode } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, Play, Users, MessageSquare, Scale, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SessionRunner({ tenantId, boardId }: { tenantId: string, boardId: string }) {
  const [, setLocation] = useLocation();
  const { data: boardDetail, isLoading } = useGetBoard(boardId);
  const createSession = useCreateSession();
  const { toast } = useToast();

  const [mode, setMode] = useState<SessionMode>(SessionMode.ADVISORY);
  const [questionText, setQuestionText] = useState("");
  const [allHands, setAllHands] = useState(false);

  const handleConvene = async () => {
    if (!questionText) return;
    
    try {
      const session = await createSession.mutateAsync({
        boardId,
        data: {
          mode,
          questionText,
          allHands
        }
      });
      setLocation(`/sessions/${session.id}`);
    } catch (err) {
      toast({
        title: "Error starting session",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!boardDetail) return <div>Board not found</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <Link href={`/t/${tenantId}/boards/${boardId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Board
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Convene Board</h1>
        <p className="text-muted-foreground mt-1">Start a new deliberation session with {boardDetail.name}.</p>
      </div>

      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle>Session Mode</CardTitle>
          <CardDescription>How should the board approach this topic?</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as SessionMode)} className="grid gap-4 md:grid-cols-3">
            <Label 
              className={cn(
                "flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer transition-colors hover:bg-accent/50",
                mode === SessionMode.ADVISORY ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
              )}
            >
              <RadioGroupItem value={SessionMode.ADVISORY} className="sr-only" />
              <MessageSquare className={cn("w-6 h-6 mb-3", mode === SessionMode.ADVISORY ? "text-primary" : "text-muted-foreground")} />
              <span className="font-medium">Advisory</span>
              <span className="text-xs text-muted-foreground text-center mt-1 font-normal">Open exploration of the topic.</span>
            </Label>
            
            <Label 
              className={cn(
                "flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer transition-colors hover:bg-accent/50",
                mode === SessionMode.BOARD ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
              )}
            >
              <RadioGroupItem value={SessionMode.BOARD} className="sr-only" />
              <Scale className={cn("w-6 h-6 mb-3", mode === SessionMode.BOARD ? "text-primary" : "text-muted-foreground")} />
              <span className="font-medium">Board Vote</span>
              <span className="text-xs text-muted-foreground text-center mt-1 font-normal">Formal vote with majority outcome.</span>
            </Label>
            
            <Label 
              className={cn(
                "flex flex-col items-center justify-center p-4 border rounded-xl cursor-pointer transition-colors hover:bg-accent/50",
                mode === SessionMode.REVIEW ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
              )}
            >
              <RadioGroupItem value={SessionMode.REVIEW} className="sr-only" />
              <CheckSquare className={cn("w-6 h-6 mb-3", mode === SessionMode.REVIEW ? "text-primary" : "text-muted-foreground")} />
              <span className="font-medium">Review</span>
              <span className="text-xs text-muted-foreground text-center mt-1 font-normal">Post-decision retrospective.</span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle>The Question</CardTitle>
          <CardDescription>What are we deliberating today?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Textarea 
            className="min-h-[150px] text-base resize-none"
            placeholder="State the core question, context, and any specific constraints..."
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
          />
          
          <div className="flex items-center justify-between p-4 border rounded-lg bg-background/50">
            <div className="space-y-0.5">
              <Label className="text-base">All Hands Mode</Label>
              <p className="text-sm text-muted-foreground">Force every member to participate regardless of relevance.</p>
            </div>
            <Switch checked={allHands} onCheckedChange={setAllHands} />
          </div>
        </CardContent>
        <div className="p-6 border-t bg-muted/20 flex justify-between items-center rounded-b-xl">
          <div className="text-sm text-muted-foreground flex items-center">
            <Users className="w-4 h-4 mr-2" />
            {boardDetail.members.length} Advisors Ready
          </div>
          <Button 
            size="lg" 
            onClick={handleConvene} 
            disabled={createSession.isPending || !questionText || boardDetail.members.length === 0}
            className="synozur-gradient text-white border-0 hover-elevate shadow-lg"
          >
            {createSession.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />}
            Convene the Board
          </Button>
        </div>
      </Card>
    </div>
  );
}