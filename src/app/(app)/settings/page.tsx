import { CalendarClock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/page-header"
import { Page } from "@/components/page"
import { getSourceStatuses } from "@/lib/sources/status"
import { listWatchlist } from "@/lib/db/watchlist-store"
import { WatchlistEditor } from "@/components/watchlist-editor"

export const dynamic = "force-dynamic"

function statusVariant(s: string): "success" | "warning" | "danger" {
  if (s === "Connected") return "success"
  if (s === "Limited") return "warning"
  return "danger"
}

export default async function SettingsPage() {
  const sources = getSourceStatuses()
  const creators = await listWatchlist()

  return (
    <Page>
      <PageHeader title="Settings" subtitle="Sources, watchlist and report cadence." />

      <Card>
        <CardHeader><CardTitle>Connected sources</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            {sources.map((s) => (
              <div key={s.name} className="flex items-center gap-4 py-3.5 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-muted-foreground text-xs">{s.detail}</p>
                </div>
                <Badge variant="outline">{s.kind}</Badge>
                <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Creator watchlist</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <WatchlistEditor initial={creators} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="text-primary size-4" /> Report cadence</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-0">
          <div>
            <p className="text-sm">Daily scan, on-demand Pulse reports.</p>
            <p className="text-muted-foreground mt-1 text-xs">Throttle: regenerating within 3 days warns that little has changed.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">Daily</Button>
            <Button variant="ghost" size="sm">Weekly</Button>
          </div>
        </CardContent>
      </Card>
    </Page>
  )
}
