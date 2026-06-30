import Link from "next/link"
import { ArrowUpRight, Clock, Music, Image as ImageIcon, Type, ShieldAlert, AlertTriangle, Radar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/page-header"
import { Page } from "@/components/page"
import { ScanActions, RegenerateButton } from "@/components/scan-actions"
import { peekScan, emptyScan } from "@/lib/scan/cache"
import { CONTENT_PILLARS } from "@/lib/persona"
import { formatIST, daysSince } from "@/lib/format"

// Live data per request. Reads the latest scan WITHOUT auto-running one — the
// radar is "ask first": a scan only runs when the user clicks Refresh scan.
export const dynamic = "force-dynamic"

function SafetyBadge({ s }: { s: string }) {
  const v = s === "Clear" ? "success" : s === "Review" ? "warning" : "danger"
  return <Badge variant={v as "success" | "warning" | "danger"}>{s}</Badge>
}
function typeIcon(t: string) {
  if (t === "Music") return <Music className="size-3.5" />
  if (t === "Visual") return <ImageIcon className="size-3.5" />
  return <Type className="size-3.5" />
}

export default async function DashboardPage() {
  const scan = (await peekScan()) ?? emptyScan()
  const idle = scan.idle === true
  const top = scan.trends.slice(0, 6)
  const pulse = scan.pulse
  const sinceDays = scan.previousPulseAt ? daysSince(scan.previousPulseAt) : null

  return (
    <Page>
      <PageHeader
        title="Dashboard"
        subtitle={idle ? "Anya's culture radar · idle — run a scan to begin" : `Anya's culture radar · refreshed ${formatIST(scan.generatedAt)}`}
      >
        <ScanActions />
      </PageHeader>

      {idle && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
              <Radar className="size-6" />
            </div>
            <div className="max-w-md">
              <p className="text-base font-semibold">Anya&apos;s radar is idle</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Nothing runs automatically. Hit <span className="font-medium">Refresh scan</span> to pull live signals
                from YouTube, Spotify &amp; Instagram, score them against Anya&apos;s brand and knowledge base, then
                <span className="font-medium"> New Pulse</span> to generate this week&apos;s report.
              </p>
            </div>
            <ScanActions />
          </CardContent>
        </Card>
      )}

      {scan.warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertTriangle className="size-5 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-900">Scan ran with {scan.warnings.length} warning(s)</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-amber-800">
                {scan.warnings.map((w, i) => (
                  <li key={i} className="break-words">{w}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {pulse && sinceDays !== null && sinceDays < 3 && (
        <Card className="border-accent bg-accent/30">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <Clock className="text-accent-foreground size-5 shrink-0" />
            <p className="text-accent-foreground min-w-0 flex-1 text-sm">
              The last Pulse was generated {sinceDays === 0 ? "today" : `${sinceDays} day(s) ago`}.
              The trend landscape has shifted little since — a new report will look similar.
            </p>
            <RegenerateButton />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {scan.kpis.map((k) => (
          <Card key={k.label} className="gap-0 py-0">
            <CardContent className="p-5">
              <div className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">{k.label}</div>
              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">{k.value}</span>
                {k.trend && <span className="text-primary text-xs font-semibold">{k.trend}</span>}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">{k.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between border-b pb-4">
            <CardTitle className="text-base tracking-tight">Today&apos;s top signals</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/trends">View all <ArrowUpRight className="size-4" /></Link></Button>
          </CardHeader>
          <CardContent className="pt-2">
            {top.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No signals surfaced. Try “Refresh scan”, or check the warnings above.
              </p>
            ) : (
              <div className="space-y-0.5">
                {top.map((t) => (
                  <div key={t.rank} className="hover:bg-muted/50 -mx-2 flex items-center gap-3.5 rounded-lg px-2 py-2.5 transition-colors">
                    <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold tabular-nums">{t.rank}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{typeIcon(t.type)}</span>
                        {t.url ? (
                          <a href={t.url} target="_blank" rel="noopener noreferrer" className="truncate text-sm font-medium hover:underline">{t.title}</a>
                        ) : (
                          <p className="truncate text-sm font-medium">{t.title}</p>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">{t.platform} · {t.volume}</p>
                    </div>
                    <div className="hidden w-28 shrink-0 sm:block">
                      <div className="text-muted-foreground mb-1 text-[11px]">Relevance {t.relevance}</div>
                      <Progress value={t.relevance} />
                    </div>
                    <SafetyBadge s={t.safety} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b pb-4"><CardTitle className="text-base tracking-tight">This week&apos;s Pulse</CardTitle></CardHeader>
            <CardContent className="space-y-4 pt-2">
              {pulse ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{pulse.title}</span>
                    <Badge variant="success">{pulse.status}</Badge>
                  </div>
                  {pulse.summary && <p className="text-muted-foreground text-xs leading-relaxed">{pulse.summary}</p>}
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between">
                      <span className="text-muted-foreground text-xs">Mumbai relevance</span>
                      <span className="text-lg font-semibold tracking-tight tabular-nums">{pulse.relevance}<span className="text-muted-foreground text-xs font-normal">/100</span></span>
                    </div>
                    <Progress value={pulse.relevance} />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-muted/40 rounded-lg py-2.5"><div className="text-xl font-semibold tracking-tight tabular-nums">{pulse.music}</div><div className="text-muted-foreground text-[11px]">Music</div></div>
                    <div className="bg-muted/40 rounded-lg py-2.5"><div className="text-xl font-semibold tracking-tight tabular-nums">{pulse.visual}</div><div className="text-muted-foreground text-[11px]">Visual</div></div>
                    <div className="bg-muted/40 rounded-lg py-2.5"><div className="text-xl font-semibold tracking-tight tabular-nums">{pulse.caption}</div><div className="text-muted-foreground text-[11px]">Caption</div></div>
                  </div>
                  <Button className="w-full" size="sm" asChild><Link href="/reports">Open report</Link></Button>
                </>
              ) : (
                <p className="text-muted-foreground py-4 text-sm">No Pulse yet — run a scan to generate this week&apos;s report.</p>
              )}
            </CardContent>
          </Card>

          {pulse && pulse.flags > 0 && (
            <Card className="border-amber-200 bg-amber-50/60">
              <CardContent className="flex items-start gap-3 py-4">
                <ShieldAlert className="size-5 shrink-0 text-amber-700" />
                <div>
                  <p className="text-sm font-medium text-amber-900">{pulse.flags} brand-safety flag(s)</p>
                  <p className="mt-0.5 text-xs text-amber-800">Signals marked Review/Avoid — keep culture-first and check before scheduling.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="border-b pb-4"><CardTitle className="text-base tracking-tight">Content pillars this month</CardTitle></CardHeader>
        <CardContent className="pt-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {CONTENT_PILLARS.map((p) => (
              <div key={p.name} className="bg-muted/30 hover:border-primary/40 hover:bg-muted/60 flex items-center justify-between rounded-lg border p-3.5 transition-colors">
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-muted-foreground text-xs">{p.role}</p>
                </div>
                <div className="text-right text-xs tabular-nums">
                  <div><span className="text-base font-semibold tracking-tight">{p.reels}</span> reels</div>
                  <div className="text-muted-foreground"><span className="text-base font-semibold tracking-tight">{p.statics}</span> statics</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </Page>
  )
}
