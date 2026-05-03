import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useGetBoard, useUpdateBoard, useDeleteBoardMember, useCreateBoardMember } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, User, Users, Play, Settings2, Plus, Trash2, Edit } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function BoardDetail({ tenantId, boardId }: { tenantId: string, boardId: string }) {
  const [, setLocation] = useLocation();
  const { data: boardDetail, isLoading, refetch } = useGetBoard(boardId);
  const updateBoard = useUpdateBoard();
  const deleteMember = useDeleteBoardMember();
  const createMember = useCreateBoardMember();
  const { toast } = useToast();

  const [instructions, setInstructions] = useState("");
  const updateRef = useRef(updateBoard.mutate);
  updateRef.current = updateBoard.mutate;

  useEffect(() => {
    if (boardDetail) {
      setInstructions(boardDetail.masterInstructionsText);
    }
  }, [boardDetail?.id]); // Only set on initial load or board change

  const handleSaveInstructions = () => {
    updateRef.current(
      { boardId, data: { masterInstructionsText: instructions } },
      { 
        onSuccess: () => {
          toast({ title: "Instructions saved", description: "Master instructions updated successfully." });
          refetch();
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  const handleAddQuickMember = async () => {
    try {
      const idx = (boardDetail?.members?.length || 0) + 1;
      await createMember.mutateAsync({
        boardId,
        data: {
          name: `Advisor ${idx}`,
          roleTitle: "Board Member"
        }
      });
      refetch();
    } catch(err) {}
  };

  const handleDeleteMember = async (memberId: string) => {
    if(!confirm("Are you sure?")) return;
    try {
      await deleteMember.mutateAsync({ memberId });
      refetch();
    } catch(err) {}
  }

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!boardDetail) return <div>Not found</div>;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/t/${tenantId}/boards`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Boards
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{boardDetail.name}</h1>
            <p className="text-muted-foreground mt-1">{boardDetail.topicArea || "No topic area"}</p>
          </div>
          <Link href={`/t/${tenantId}/boards/${boardId}/run`}>
            <Button size="lg" className="synozur-gradient text-white border-0">
              <Play className="w-4 h-4 mr-2" />
              Run Session
            </Button>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="members" className="flex items-center"><Users className="w-4 h-4 mr-2"/> Members ({boardDetail.members.length}/{boardDetail.size})</TabsTrigger>
          <TabsTrigger value="instructions" className="flex items-center"><Settings2 className="w-4 h-4 mr-2"/> Master Instructions</TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center"><Settings2 className="w-4 h-4 mr-2"/> Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Board Members</h2>
            <Button size="sm" onClick={handleAddQuickMember} disabled={boardDetail.members.length >= boardDetail.size}>
              <Plus className="w-4 h-4 mr-1" /> Add Member
            </Button>
          </div>
          
          <div className="grid gap-3">
            {boardDetail.members.map(member => (
              <Card key={member.id} className="bg-card/50">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary mr-4">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-base">{member.name}</h3>
                      <p className="text-sm text-muted-foreground">{member.roleTitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/t/${tenantId}/boards/${boardId}/members/${member.id}`}>
                      <Button variant="ghost" size="sm"><Edit className="w-4 h-4" /></Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteMember(member.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {boardDetail.members.length === 0 && (
              <div className="text-center py-12 border rounded-xl border-dashed">
                <p className="text-muted-foreground">No members added yet.</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="instructions">
          <Card className="bg-card/50">
            <CardHeader>
              <CardTitle>Master Instructions</CardTitle>
              <CardDescription>These instructions apply to all members and frame the overall persona of the board.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="flex justify-end">
                <span className={instructions.length > 7500 ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                  {instructions.length} / 7500 chars {instructions.length > 7500 && "(Soft warning)"}
                </span>
               </div>
               <Textarea 
                 className="min-h-[400px] font-mono text-sm"
                 value={instructions}
                 onChange={e => setInstructions(e.target.value)}
                 placeholder="Enter system prompt framing..."
               />
               <Button onClick={handleSaveInstructions} disabled={updateBoard.isPending}>
                 {updateBoard.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                 Save Instructions
               </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="bg-card/50">
             <CardHeader>
               <CardTitle>Board Settings</CardTitle>
             </CardHeader>
             <CardContent className="space-y-6">
                {/* Basic settings form would go here, omitting for brevity in favor of instructions/members */}
                <p className="text-sm text-muted-foreground">Additional configuration (models, temperature) can be managed here.</p>
             </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}