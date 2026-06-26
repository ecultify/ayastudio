import { Music, Image as ImageIcon, Type, Check, X, Trophy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/page-header"
import { Page } from "@/components/page"
import { PrintButton } from "@/components/print-button"
import { getScan } from "@/lib/scan/cache"

export const dynamic = "force-dynamic"

function fixtureWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

export default async function ReportsPage() {
  const scan = await getScan()
  const pulse = scan.pulse
  const trends = scan.trends
  const fixtures = scan.fixtures ?? []

  const sections = [
    { title: "Top music trends", icon: Music, items: trends.filter((t) => t.type === "Music").slice(0, 5) },
    { title: "Top visual trends", icon: ImageIcon, items: trends.filter((t) => t.type === "Visual").slice(0, 5) },
    { title: "Top caption trends", icon: Type, items: trends.filter((t) => t.type === "Caption").slice(0, 5) },
  ]

  if (!pulse) {
    return (
      <Page>
        <PageHeader title="Pulse Reports" subtitle="Weekly direction, generated from the live signal scan." />
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No Pulse yet. Run a scan or generate a new Pulse from the dashboard.
          </CardContent>
        </Card>
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader title="Pulse Reports" subtitle="Weekly direction, generated from the live signal scan.">
        <PrintButton />
      </PageHeader>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{pulse.title}</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">{pulse.date} · Mumbai relevance {pulse.relevance}/100</p>
          </div>
          <Badge variant="success">{pulse.status}</Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          {pulse.summary && <p className="text-sm leading-relaxed">{pulse.summary}</p>}

          <div className="grid gap-6 md:grid-cols-3">
            {sections.map((s) => {
              const Icon = s.icon
              return (
                <div key={s.title}>
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className="text-primary size-4" />
                    <h3 className="text-sm font-semibold">{s.title}</h3>
                  </div>
                  {s.items.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No signals this week.</p>
                  ) : (
                    <ol className="space-y-2.5">
                      {s.items.map((it, i) => (
                        <li key={it.rank} className="flex gap-2.5 text-sm">
                          <span className="text-muted-foreground tabular-nums">{i + 1}</span>
                          <span className="text-foreground/90 leading-snug">{it.title}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )
            })}
          </div>

          {(pulse.dos.length > 0 || pulse.donts.length > 0) && (
            <>
              <Separator />
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Do this week</h3>
                  <ul className="space-y-2">
                    {pulse.dos.map((d) => (
                      <li key={d} className="flex gap-2 text-sm"><Check className="text-primary mt-0.5 size-4 shrink-0" /><span>{d}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-3 text-sm font-semibold">Avoid this week</h3>
                  <ul className="space-y-2">
                    {pulse.donts.map((d) => (
                      <li key={d} className="flex gap-2 text-sm"><X className="text-destructive mt-0.5 size-4 shrink-0" /><span>{d}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}

          {fixtures.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <Trophy className="text-primary size-4" />
                  <h3 className="text-sm font-semibold">Match-night calendar</h3>
                  <span className="text-muted-foreground text-xs">culture-first, no betting</span>
                </div>
                <ul className="divide-y">
                  {fixtures.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{f.matchup}</span>
                        <span className="text-muted-foreground"> · {f.tournament}</span>
                      </span>
                      {f.india && <Badge variant="success">India</Badge>}
                      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{fixtureWhen(f.startsAt)} IST</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs">
        Showing the current live Pulse. Report history (week-over-week) becomes available once a database is connected.
      </p>
    </Page>
  )
}
