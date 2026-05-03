import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  useGetBoard, 
  useListBoardMembers, 
  useUpdateBoardMember, 
  useRegisterGroundingDocument 
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Loader2, Save, FileText, AlertTriangle } from "lucide-react";
import { ObjectUploader } from "@workspace/object-storage-web";

export default function MemberEditor({ tenantId, boardId, memberId }: { tenantId: string, boardId: string, memberId: string }) {
  const [, setLocation] = useLocation();
  const { data: members, isLoading } = useListBoardMembers(boardId);
  const updateMember = useUpdateBoardMember();
  const registerDocument = useRegisterGroundingDocument();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    roleTitle: "",
    lensDescription: "",
    instructionsText: "",
    modelOverride: ""
  });

  const member = members?.find(m => m.id === memberId);

  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name || "",
        roleTitle: member.roleTitle || "",
        lensDescription: member.lensDescription || "",
        instructionsText: member.instructionsText || "",
        modelOverride: member.modelOverride || ""
      });
    }
  }, [member]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateMember.mutateAsync({
        memberId,
        data: {
          name: formData.name,
          roleTitle: formData.roleTitle,
          lensDescription: formData.lensDescription || undefined,
          instructionsText: formData.instructionsText || undefined,
          modelOverride: formData.modelOverride || undefined
        }
      });
      setLocation(`/t/${tenantId}/boards/${boardId}`);
    } catch (err) {
      toast({
        title: "Error saving member",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const handleGetUploadParameters = async (file: any) => {
    const res = await fetch(`/api/storage/uploads/request-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      }),
    });
    const data = await res.json();
    
    // Store object path to register after upload
    (file as any).replitObjectPath = data.objectPath;
    
    return {
      method: "PUT" as const,
      url: data.uploadURL,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    };
  };

  const handleUploadComplete = async (result: any) => {
    if (result.successful && result.successful.length > 0) {
      const file = result.successful[0];
      const objectPath = file.replitObjectPath;
      
      try {
        const doc = await registerDocument.mutateAsync({
          data: {
            tenantId,
            objectPath,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size
          }
        });
        
        await updateMember.mutateAsync({
          memberId,
          data: {
            groundingDocumentId: doc.id
          }
        });
        
        toast({
          title: "Document attached",
          description: "Grounding document successfully uploaded and attached to this advisor."
        });
      } catch (err) {
        toast({
          title: "Error attaching document",
          description: err instanceof Error ? err.message : "Failed to register document",
          variant: "destructive"
        });
      }
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!member) return <div>Member not found</div>;

  const doc = member.groundingDocument;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div>
        <Link href={`/t/${tenantId}/boards/${boardId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Board
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Edit Advisor: {member.name}</h1>
        <p className="text-muted-foreground mt-1">Configure this advisor's identity, lens, and custom instructions.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roleTitle">Role / Title</Label>
                <Input 
                  id="roleTitle" 
                  value={formData.roleTitle}
                  onChange={e => setFormData(p => ({ ...p, roleTitle: e.target.value }))}
                  placeholder="e.g. Chief Marketing Officer"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lensDescription">Lens Description</Label>
              <Input 
                id="lensDescription" 
                value={formData.lensDescription}
                onChange={e => setFormData(p => ({ ...p, lensDescription: e.target.value }))}
                placeholder="e.g. Evaluates decisions based on brand impact and market positioning."
              />
              <p className="text-xs text-muted-foreground">A brief summary of what this advisor cares about most.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Instructions</CardTitle>
              <span className={formData.instructionsText.length > 7500 ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
                {formData.instructionsText.length} / 1500 target {formData.instructionsText.length > 7500 && "(Soft warning)"}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea 
              className="min-h-[300px] font-mono text-sm"
              value={formData.instructionsText}
              onChange={e => setFormData(p => ({ ...p, instructionsText: e.target.value }))}
              placeholder="You are the CMO. You speak with authority but listen to data..."
            />
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle>Grounding Document</CardTitle>
            <CardDescription>Attach a PDF or text document to provide specific knowledge to this advisor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {doc ? (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-background/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(doc.characterCount).toLocaleString()} chars
                    </p>
                  </div>
                </div>
                <ObjectUploader
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleUploadComplete}
                  buttonClassName="text-sm font-medium px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
                >
                  Replace
                </ObjectUploader>
              </div>
            ) : (
              <div className="flex justify-center border-2 border-dashed border-border rounded-lg p-6">
                <ObjectUploader
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleUploadComplete}
                  buttonClassName="text-sm font-medium px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Upload Document
                </ObjectUploader>
              </div>
            )}
            
            {doc?.truncated && (
              <div className="flex items-start gap-2 p-3 bg-amber-500/10 text-amber-500 rounded-md border border-amber-500/20">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <p className="text-sm">This document was too large and has been truncated. The advisor will only see the beginning of the file.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle>Advanced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="modelOverride">Model Override (Optional)</Label>
              <Input 
                id="modelOverride" 
                value={formData.modelOverride}
                onChange={e => setFormData(p => ({ ...p, modelOverride: e.target.value }))}
                placeholder="e.g. claude-3-7-sonnet-20250219"
              />
              <p className="text-xs text-muted-foreground">Leave blank to use the board's default model.</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 sticky bottom-4">
          <Link href={`/t/${tenantId}/boards/${boardId}`}>
            <Button variant="secondary" type="button" className="bg-card shadow-lg border border-border">Cancel</Button>
          </Link>
          <Button type="submit" disabled={updateMember.isPending} className="shadow-lg">
            {updateMember.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Advisor
          </Button>
        </div>
      </form>
    </div>
  );
}