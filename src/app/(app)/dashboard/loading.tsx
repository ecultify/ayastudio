import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/page-header"
import { Page } from "@/components/page"

/** Shown while the first live scan runs (discovery + LLM scoring can take a few seconds). */
export default function DashboardLoading() {
  return (
    <Page>
      <PageHeader title="Dashboard" subtitle="Running culture scan…" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-5">
              <div className="bg-muted h-3 w-24 animate-pulse rounded" />
              <div className="bg-muted mt-3 h-8 w-16 animate-pulse rounded" />
              <div className="bg-muted mt-2 h-3 w-20 animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 py-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-muted h-10 animate-pulse rounded" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 py-6">
            <div className="bg-muted h-32 animate-pulse rounded" />
            <div className="bg-muted h-20 animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    </Page>
  )
}
