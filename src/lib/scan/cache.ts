import { runScan } from "./run"
import { generatePulse } from "./score"
import { saveScanState, loadScanState, saveReport } from "@/lib/db/scan-store"
import type { Kpi, ScanResult } from "./types"

// Scan cache. The latest scan lives in module memory (with a TTL) and is also
// persisted to Postgres so it survives restarts. Unlike before, reads do NOT
// auto-trigger a scan — the dashboard is "ask first": a scan only runs when the
// user explicitly hits Refresh scan / New Pulse. `previous` is kept to compute
// week-over-week KPI deltas and the "days since" banner.

let current: ScanResult | null = null
let previous: ScanResult | null = null
let inflight: Promise<ScanResult> | null = null

/** An idle, empty scan used before the user has run their first scan. */
export function emptyScan(): ScanResult {
  return {
    generatedAt: new Date(0).toISOString(),
    trends: [],
    pulse: null,
    kpis: [
      { label: "Signals scanned", value: "—", sub: "run a scan" },
      { label: "Trends surfaced", value: "—", sub: "after scoring" },
      { label: "Mumbai relevance", value: "—", sub: "avg score /100" },
      { label: "Brand-safety flags", value: "—", sub: "needs review" },
    ],
    scannedCount: 0,
    fixtures: [],
    warnings: [],
    idle: true,
  }
}

/**
 * Return the latest scan WITHOUT triggering a new one: in-memory if present,
 * else the persisted snapshot from the DB, else null. Used by all pages so
 * nothing scans automatically.
 */
export async function peekScan(): Promise<ScanResult | null> {
  if (current) return current
  const stored = await loadScanState()
  if (stored) {
    current = stored
    return current
  }
  return null
}

/** Force a brand-new scan (Refresh scan action). Persists + records a report. */
export async function refreshScan(): Promise<ScanResult> {
  if (inflight) return inflight
  inflight = runScan()
    .then(async (r) => {
      commit(r)
      await persist(current as ScanResult)
      return current as ScanResult
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Regenerate only the Pulse from the current trend set (New Pulse action). */
export async function regeneratePulse(): Promise<ScanResult> {
  const base = await peekScan()
  if (!base || base.trends.length === 0) return refreshScan()
  const now = new Date()
  const pulse = await generatePulse(base.trends, now, base.fixtures)
  const prevPulseAt = base.pulse ? base.generatedAt : base.previousPulseAt
  current = { ...base, pulse, generatedAt: now.toISOString(), previousPulseAt: prevPulseAt, idle: false }
  await persist(current)
  return current
}

async function persist(scan: ScanResult): Promise<void> {
  await Promise.all([saveScanState(scan), saveReport(scan)])
}

/** Store a new scan as current, rolling the old one into `previous` for deltas. */
function commit(r: ScanResult): void {
  previous = current
  current = {
    ...r,
    idle: false,
    kpis: withDeltas(r.kpis, previous?.kpis),
    previousPulseAt: previous?.pulse ? previous.generatedAt : previous?.previousPulseAt,
  }
}

/** Attach +N / −N deltas to KPI cards by comparing numeric values to the prior scan. */
function withDeltas(next: Kpi[], prev?: Kpi[]): Kpi[] {
  if (!prev) return next
  return next.map((k) => {
    const before = prev.find((p) => p.label === k.label)
    if (!before) return k
    const a = Number(k.value)
    const b = Number(before.value)
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return k
    const diff = a - b
    return { ...k, trend: `${diff > 0 ? "+" : "−"}${Math.abs(diff)}` }
  })
}
