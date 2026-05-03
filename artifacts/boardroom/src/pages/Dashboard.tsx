import { useGetTenantDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Plus, Users, Clock, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard({ tenantId }: { tenantId: string }) {
  const { data: dashboard, isLoading } = useGetTenantDashboard(tenantId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your boards and recent sessions.</p>
        </div>
        <Link href={`/t/${tenantId}/boards/new`}>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Board
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Boards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard?.boardCount || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard?.sessionCount || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Advisors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard?.memberCount || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-medium tracking-tight">Top Boards</h2>
            <Link href={`/t/${tenantId}/boards`} className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {dashboard?.topBoards?.map(board => (
              <Link key={board.id} href={`/t/${tenantId}/boards/${board.id}`}>
                <Card className="hover-elevate cursor-pointer transition-colors bg-card/50">
                  <CardHeader className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{board.name}</CardTitle>
                        <CardDescription className="mt-1 line-clamp-1">{board.topicArea}</CardDescription>
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Users className="w-3 h-3 mr-1" />
                        {board.memberCount}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
            {!dashboard?.topBoards?.length && (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
                No boards created yet.
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-medium tracking-tight mb-4">Recent Sessions</h2>
          <div className="space-y-4">
            {dashboard?.recentSessions?.map(session => (
              <Link key={session.id} href={`/sessions/${session.id}`}>
                <Card className="hover-elevate cursor-pointer transition-colors bg-card/50">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs font-medium px-2 py-0.5 rounded-sm bg-secondary/10 text-secondary">
                        {session.mode}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
                      </div>
                    </div>
                    <p className="text-sm font-medium line-clamp-2">{session.questionText}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {!dashboard?.recentSessions?.length && (
              <div className="text-sm text-muted-foreground py-8 text-center border rounded-lg border-dashed">
                No sessions run yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}