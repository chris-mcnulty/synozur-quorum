import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useCreateBoard, BoardSize } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2 } from "lucide-react";

export default function CreateBoard({ tenantId }: { tenantId: string }) {
  const [, setLocation] = useLocation();
  const createBoard = useCreateBoard();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    topicArea: "",
    size: "5",
    masterInstructionsText: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      const board = await createBoard.mutateAsync({
        tenantId,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          topicArea: formData.topicArea || undefined,
          size: parseInt(formData.size) as any,
          masterInstructionsText: formData.masterInstructionsText || undefined
        }
      });
      setLocation(`/t/${tenantId}/boards/${board.id}`);
    } catch (err) {
      toast({
        title: "Error creating board",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <Link href={`/t/${tenantId}/boards`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Boards
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Create Board</h1>
        <p className="text-muted-foreground mt-1">Define the purpose and rules for a new board of advisors.</p>
      </div>

      <Card className="bg-card/50">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Board Name <span className="text-destructive">*</span></Label>
              <Input 
                id="name" 
                placeholder="e.g. Product Strategy Board" 
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="topicArea">Topic Area</Label>
                <Input 
                  id="topicArea" 
                  placeholder="e.g. Enterprise B2B SaaS" 
                  value={formData.topicArea}
                  onChange={e => setFormData(p => ({ ...p, topicArea: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="size">Board Size</Label>
                <Select 
                  value={formData.size} 
                  onValueChange={v => setFormData(p => ({ ...p, size: v }))}
                >
                  <SelectTrigger id="size">
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 Advisors</SelectItem>
                    <SelectItem value="5">5 Advisors</SelectItem>
                    <SelectItem value="7">7 Advisors</SelectItem>
                    <SelectItem value="9">9 Advisors</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                placeholder="What decisions does this board handle?" 
                className="h-20"
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="masterInstructions">Master Instructions (Optional)</Label>
                <span className="text-xs text-muted-foreground">{formData.masterInstructionsText.length} / 7500 chars</span>
              </div>
              <Textarea 
                id="masterInstructions" 
                placeholder="These instructions apply to all members and the chair..." 
                className="h-40 font-mono text-sm"
                value={formData.masterInstructionsText}
                onChange={e => setFormData(p => ({ ...p, masterInstructionsText: e.target.value }))}
              />
            </div>
          </CardContent>
          <div className="p-6 border-t bg-muted/20 flex justify-end gap-3 rounded-b-xl">
            <Link href={`/t/${tenantId}/boards`}>
              <Button variant="ghost" type="button">Cancel</Button>
            </Link>
            <Button type="submit" disabled={createBoard.isPending || !formData.name}>
              {createBoard.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Board
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}