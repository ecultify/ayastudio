// Shared types for the live "culture radar" scan pipeline.
// These intentionally mirror the shapes the dashboard UI already consumes
// (see the original mock in src/lib/data.ts) so the page JSX stays unchanged.

export type Platform = "Instagram" | "YouTube" | "Spotify" | "Google Trends"
export type TrendType = "Music" | "Visual" | "Caption"
export type Safety = "Clear" | "Review" | "Avoid"

/** A raw discovery candidate from one source, before LLM scoring. */
export type Candidate = {
  source: Platform
  platform: Platform
  title: string
  subtitle?: string
  url?: string
  /** Human-readable volume/recency signal, e.g. "2.1M views" or "Released 2026-06-12". */
  metric?: string
}

/** A candidate after relevance + brand-safety scoring, without its final rank. */
export type ScoredTrend = {
  title: string
  platform: Platform
  type: TrendType
  relevance: number
  safety: Safety
  volume: string
  note: string
  url?: string
}

/** Final ranked trend rendered in the dashboard's "top signals" list. */
export type Trend = ScoredTrend & { rank: number }

/** The weekly "Pulse" report summary card. */
export type Pulse = {
  id: string
  title: string
  date: string
  status: string
  relevance: number
  music: number
  visual: number
  caption: number
  flags: number
  summary: string
  dos: string[]
  donts: string[]
}

export type Kpi = { label: string; value: string; sub: string; trend?: string }

/** An upcoming cricket fixture (Sportradar) used for match-night culture timing. */
export type Fixture = {
  id: string
  tournament: string
  /** "India vs England" style matchup. */
  matchup: string
  /** ISO start time (UTC). */
  startsAt: string
  /** Short tag, e.g. "International" or "T20 league". */
  note: string
  /** True when India are playing — the strongest match-night signal. */
  india: boolean
}

/** Full result of one scan run, cached in memory until refreshed. */
export type ScanResult = {
  /** ISO timestamp of when this scan was produced. */
  generatedAt: string
  trends: Trend[]
  pulse: Pulse | null
  kpis: Kpi[]
  scannedCount: number
  /** Upcoming cricket fixtures for match-night planning (Sportradar). */
  fixtures: Fixture[]
  /** Non-fatal source/scoring failures to surface in the UI. */
  warnings: string[]
  /** ISO timestamp of the previous pulse, if one was generated before. */
  previousPulseAt?: string
  /** True for the placeholder scan shown before the user runs their first scan. */
  idle?: boolean
}
