import { useListBoards } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus, Users, Clock, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Boards({ tenantId }: { tenantId: string }) {
  const { data: boards, isLoading } = useListBoards(tenantId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Boards of Advisors</h1>
          <p className="text-muted-foreground mt-1">Manage your specialized advisory panels.</p>
        </div>
        <Link href={`/t/${tenantId}/boards/new`}>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Board
          </Button>
        </Link>
      </div>

      {!boards?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-2">No boards yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Create your first board of advisors to start deliberating on important topics.
            </p>
            <Link href={`/t/${tenantId}/boards/new`}>
              <Button>Create Board</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boards.map(board => (
            <Link key={board.id} href={`/t/${tenantId}/boards/${board.id}`}>
              <Card className="hover-elevate cursor-pointer transition-colors h-full flex flex-col bg-card/50">
                <CardHeader>
                  <CardTitle className="text-lg line-clamp-1">{board.name}</CardTitle>
                  {board.topicArea && <CardDescription className="line-clamp-1">{board.topicArea}</CardDescription>}
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-end">
                  {board.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{board.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-4 border-t border-border/50">
                    <div className="flex items-center">
                      <Users className="w-3.5 h-3.5 mr-1.5" />
                      {board.memberCount} / {board.size}
                    </div>
                    {board.lastSessionAt && (
                      <div className="flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                        {formatDistanceToNow(new Date(board.lastSessionAt))} ago
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}