import { Music, Image as ImageIcon, Type } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PageHeader } from "@/components/page-header"
import { Page } from "@/components/page"
import { peekScan, emptyScan } from "@/lib/scan/cache"
import type { Trend } from "@/lib/scan/types"

export const dynamic = "force-dynamic"

function SafetyBadge({ s }: { s: string }) {
  const v = s === "Clear" ? "success" : s === "Review" ? "warning" : "danger"
  return <Badge variant={v as "success" | "warning" | "danger"}>{s}</Badge>
}
function TypeTag({ t }: { t: string }) {
  const Icon = t === "Music" ? Music : t === "Visual" ? ImageIcon : Type
  return <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs"><Icon className="size-3.5" />{t}</span>
}

function TrendRow({ t }: { t: Trend }) {
  return (
    <div className="grid grid-cols-12 items-center gap-3 px-5 py-4">
      <div className="col-span-12 sm:col-span-6">
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground font-serif w-5 text-lg tabular-nums">{t.rank}</span>
          <div className="min-w-0">
            {t.url ? (
              <a href={t.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium hover:underline">{t.title}</a>
            ) : (
              <p className="truncate text-sm font-medium">{t.title}</p>
            )}
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{t.note}</p>
          </div>
        </div>
      </div>
      <div className="col-span-4 sm:col-span-2"><Badge variant="outline">{t.platform}</Badge></div>
      <div className="col-span-4 sm:col-span-2"><TypeTag t={t.type} /></div>
      <div className="col-span-2 hidden sm:block">
        <div className="text-muted-foreground mb-1 text-[11px] tabular-nums">{t.relevance}/100</div>
        <Progress value={t.relevance} />
      </div>
      <div className="col-span-4 flex justify-end sm:col-span-12 sm:hidden"><SafetyBadge s={t.safety} /></div>
      <div className="col-span-2 hidden justify-end sm:flex"><SafetyBadge s={t.safety} /></div>
    </div>
  )
}

function TrendTable({ rows }: { rows: Trend[] }) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center text-sm">
          No signals in this category yet. Run a scan from the dashboard to refresh.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="overflow-hidden p-0">
      <div className="text-muted-foreground bg-muted/50 hidden grid-cols-12 gap-3 border-b px-5 py-2.5 text-[11px] font-medium tracking-wide uppercase sm:grid">
        <div className="col-span-6">Signal</div>
        <div className="col-span-2">Platform</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-2 text-right">Safety</div>
      </div>
      <CardContent className="p-0">
        <div className="divide-y">{rows.map((t) => <TrendRow key={t.rank} t={t} />)}</div>
      </CardContent>
    </Card>
  )
}

export default async function TrendsPage() {
  const scan = (await peekScan()) ?? emptyScan()
  const trends = scan.trends
  const by = (type: string) => trends.filter((t) => t.type === type)
  return (
    <Page>
      <PageHeader title="Trends" subtitle="Scored, deduped signals from YouTube, Spotify + Instagram, ranked by Mumbai relevance." />
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({trends.length})</TabsTrigger>
          <TabsTrigger value="Music">Music</TabsTrigger>
          <TabsTrigger value="Visual">Visual</TabsTrigger>
          <TabsTrigger value="Caption">Caption</TabsTrigger>
        </TabsList>
        <TabsContent value="all"><TrendTable rows={trends} /></TabsContent>
        <TabsContent value="Music"><TrendTable rows={by("Music")} /></TabsContent>
        <TabsContent value="Visual"><TrendTable rows={by("Visual")} /></TabsContent>
        <TabsContent value="Caption"><TrendTable rows={by("Caption")} /></TabsContent>
      </Tabs>
    </Page>
  )
}
