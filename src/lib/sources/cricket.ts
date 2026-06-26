import type { Fixture } from "@/lib/scan/types"

// Sportradar Cricket v2 — upcoming fixtures for "Match-night Culture" planning.
// The package exposes a per-date schedule (no combined upcoming feed), so we walk
// a short forward window. Trial keys are call-limited (≈1 QPS), so the combined
// result is cached in module memory and dates are fetched sequentially.

const BASE = "https://api.sportradar.com/cricket-t2/en"
const WINDOW_DAYS = 6
const MAX_FIXTURES = 8
const REQUEST_TIMEOUT_MS = 8_000
const CACHE_TTL_MS = 1000 * 60 * 60 * 12 // 12h — keep trial call volume low

// Tournaments that read as genuine match-night moments for an India audience.
const MAJOR = /international|world cup|champions trophy|asia cup|ipl|indian premier|major league|the hundred|big bash|t20i|odi|test match/i

type SrCompetitor = { name?: string; qualifier?: string }
type SrEvent = {
  id?: string
  scheduled?: string
  tournament?: { name?: string }
  season?: { name?: string }
  competitors?: SrCompetitor[]
}

let cache: { value: Fixture[]; expiresAt: number } | null = null

function istDateStrings(days: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getTime() + i * 86_400_000)
    // Format the date in IST so "today" lines up with the audience's day.
    out.push(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })) // YYYY-MM-DD
  }
  return out
}

async function fetchDate(date: string, key: string): Promise<SrEvent[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}/schedules/${date}/schedule.json?api_key=${key}`, {
      cache: "no-store",
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`Sportradar ${res.status}`)
    const data = (await res.json()) as { sport_events?: SrEvent[] }
    return data.sport_events ?? []
  } finally {
    clearTimeout(timer)
  }
}

function toFixture(e: SrEvent): Fixture | null {
  if (!e.id || !e.scheduled) return null
  const comps = e.competitors ?? []
  const names = comps.map((c) => c.name).filter(Boolean) as string[]
  const matchup = names.length >= 2 ? `${names[0]} vs ${names[1]}` : (e.tournament?.name ?? "Cricket fixture")
  const tournament = e.tournament?.name ?? e.season?.name ?? "Cricket"
  const india = names.some((n) => /^india/i.test(n)) || /india/i.test(tournament)
  const note = india ? "India" : MAJOR.test(tournament) ? "Major" : "League"
  return { id: e.id, tournament, matchup, startsAt: e.scheduled, note, india }
}

/** Rank: India games first, then majors, then soonest. */
function priority(f: Fixture): number {
  let p = 0
  if (f.india) p += 100
  if (f.note === "Major") p += 40
  return p
}

/**
 * Upcoming cricket fixtures over the next ~week, India/major matches first.
 * Best-effort: per-date failures are skipped; a total failure throws so the
 * scan orchestrator records a single warning.
 */
export async function fetchUpcomingFixtures(): Promise<Fixture[]> {
  const key = process.env.SPORTRADAR_CRICKET_API_KEY
  if (!key) return []
  if (cache && Date.now() < cache.expiresAt) return cache.value

  const dates = istDateStrings(WINDOW_DAYS)
  const seen = new Set<string>()
  const fixtures: Fixture[] = []
  let anySuccess = false
  let lastErr = ""

  // Sequential to respect the trial QPS limit.
  for (const date of dates) {
    try {
      const events = await fetchDate(date, key)
      anySuccess = true
      for (const e of events) {
        const f = toFixture(e)
        if (f && !seen.has(f.id)) {
          seen.add(f.id)
          fixtures.push(f)
        }
      }
    } catch (e) {
      lastErr = (e as Error).message
    }
  }

  if (!anySuccess) throw new Error(lastErr || "Sportradar: all date requests failed")

  const ranked = fixtures
    .sort((a, b) => priority(b) - priority(a) || a.startsAt.localeCompare(b.startsAt))
    .slice(0, MAX_FIXTURES)

  cache = { value: ranked, expiresAt: Date.now() + CACHE_TTL_MS }
  return ranked
}
