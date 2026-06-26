import { fetchYouTubeTrending } from "@/lib/sources/youtube"
import { fetchSpotifyTrending } from "@/lib/sources/spotify"
import { fetchInstagramTrending } from "@/lib/sources/instagram"
import { fetchUpcomingFixtures } from "@/lib/sources/cricket"
import { scoreCandidates, generatePulse } from "./score"
import type { Candidate, Fixture, Kpi, ScanResult, Trend } from "./types"

const SOURCES: { label: string; fetch: () => Promise<Candidate[]> }[] = [
  { label: "YouTube Data API", fetch: fetchYouTubeTrending },
  { label: "Spotify", fetch: fetchSpotifyTrending },
  // Instagram (Apify) self-skips when APIFY_TOKEN is unset, returning [].
  { label: "Instagram (Apify)", fetch: fetchInstagramTrending },
]

// Cap candidates sent to the LLM so a cold scan stays responsive (bounded output).
const MAX_CANDIDATES = 32

/** Run a full discovery → scoring → Pulse scan. Degrades gracefully per source. */
export async function runScan(): Promise<ScanResult> {
  const now = new Date()
  const warnings: string[] = []

  // 1. Discovery (parallel, per-source error isolation). Cricket fixtures run
  // alongside the candidate sources but feed the Pulse context, not scoring.
  const [settled, fixturesSettled] = await Promise.all([
    Promise.allSettled(SOURCES.map((s) => s.fetch())),
    fetchUpcomingFixtures().then(
      (value) => ({ ok: true as const, value }),
      (reason) => ({ ok: false as const, reason }),
    ),
  ])
  const discovered: Candidate[] = []
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") discovered.push(...r.value)
    else warnings.push(`${SOURCES[i].label}: ${errMsg(r.reason)}`)
  })

  let fixtures: Fixture[] = []
  if (fixturesSettled.ok) fixtures = fixturesSettled.value
  else warnings.push(`Sportradar Cricket: ${errMsg(fixturesSettled.reason)}`)
  // Interleave sources so the cap keeps a mix, not just the first source.
  const lists = settled
    .filter((r): r is PromiseFulfilledResult<Candidate[]> => r.status === "fulfilled")
    .map((r) => r.value)
  const candidates = interleave(lists).slice(0, MAX_CANDIDATES)

  // 2. Scoring + Pulse (best-effort; a failure here leaves trends empty + a warning)
  let trends: Trend[] = []
  let pulse: ScanResult["pulse"] = null
  if (candidates.length > 0) {
    try {
      const scored = await scoreCandidates(candidates)
      trends = scored
        .sort((a, b) => b.relevance - a.relevance)
        .map((t, i) => ({ ...t, rank: i + 1 }))
      pulse = await generatePulse(trends, now, fixtures)
    } catch (e) {
      warnings.push(`Scoring: ${errMsg(e)}`)
    }
  } else {
    warnings.push("No candidates discovered from any source.")
  }

  return {
    generatedAt: now.toISOString(),
    trends,
    pulse,
    kpis: deriveKpis(discovered.length, trends),
    scannedCount: discovered.length,
    fixtures,
    warnings,
  }
}

/** Round-robin merge of per-source candidate lists. */
function interleave(lists: Candidate[][]): Candidate[] {
  const out: Candidate[] = []
  const max = Math.max(0, ...lists.map((l) => l.length))
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i])
    }
  }
  return out
}

/** KPI cards derived from a single scan (deltas are filled in by the cache layer). */
export function deriveKpis(scannedCount: number, trends: Trend[]): Kpi[] {
  const surfaced = trends.length
  const avgRelevance = surfaced
    ? Math.round(trends.reduce((s, t) => s + t.relevance, 0) / surfaced)
    : 0
  const flags = trends.filter((t) => t.safety !== "Clear").length
  return [
    { label: "Signals scanned", value: String(scannedCount), sub: "this scan" },
    { label: "Trends surfaced", value: String(surfaced), sub: "after scoring" },
    { label: "Mumbai relevance", value: String(avgRelevance), sub: "avg score /100" },
    { label: "Brand-safety flags", value: String(flags), sub: "needs review" },
  ]
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
