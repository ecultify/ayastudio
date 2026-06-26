import { runScan } from "./run"
import { generatePulse } from "./score"
import type { Kpi, ScanResult } from "./types"

// In-memory scan cache. There is no DB yet, so the latest scan lives in module
// memory with a TTL; server actions invalidate it explicitly. `previous` is kept
// only to compute week-over-week-style KPI deltas and the "days since" banner.
const TTL_MS = 1000 * 60 * 60 * 3 // 3 hours

let current: ScanResult | null = null
let previous: ScanResult | null = null
let inflight: Promise<ScanResult> | null = null

function isFresh(r: ScanResult | null): r is ScanResult {
  return !!r && Date.now() - new Date(r.generatedAt).getTime() < TTL_MS
}

/** Get the cached scan, running one (deduped across concurrent callers) if stale. */
export async function getScan(): Promise<ScanResult> {
  if (isFresh(current)) return current
  if (inflight) return inflight
  inflight = runScan()
    .then((r) => {
      commit(r)
      return current as ScanResult
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** Force a brand-new scan (Refresh scan action). */
export async function refreshScan(): Promise<ScanResult> {
  inflight = null
  const r = await runScan()
  commit(r)
  return current as ScanResult
}

/** Regenerate only the Pulse from the current trend set (New Pulse action). */
export async function regeneratePulse(): Promise<ScanResult> {
  if (!current || current.trends.length === 0) return refreshScan()
  const now = new Date()
  const pulse = await generatePulse(current.trends, now, current.fixtures)
  const prevPulseAt = current.pulse ? current.generatedAt : current.previousPulseAt
  current = { ...current, pulse, generatedAt: now.toISOString(), previousPulseAt: prevPulseAt }
  return current
}

/** Store a new scan as current, rolling the old one into `previous` for deltas. */
function commit(r: ScanResult): void {
  previous = current
  current = {
    ...r,
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
