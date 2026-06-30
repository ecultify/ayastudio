import "server-only"
import { query, withDb } from "./index"
import type { ScanResult } from "@/lib/scan/types"

/** Persist the latest scan snapshot so the dashboard survives restarts. */
export async function saveScanState(scan: ScanResult): Promise<void> {
  await withDb(async () => {
    await query(
      `INSERT INTO scan_state (id, payload, generated_at)
       VALUES ('current', $1, $2)
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, generated_at = EXCLUDED.generated_at`,
      [JSON.stringify(scan), scan.generatedAt],
    )
  }, undefined)
}

export async function loadScanState(): Promise<ScanResult | null> {
  return withDb(async () => {
    const r = await query<{ payload: ScanResult }>(`SELECT payload FROM scan_state WHERE id = 'current'`)
    return r.rows[0]?.payload ?? null
  }, null)
}

/** Save a generated Pulse + its scan snapshot to the report history. */
export async function saveReport(scan: ScanResult): Promise<void> {
  const pulse = scan.pulse
  if (!pulse) return
  await withDb(async () => {
    await query(
      `INSERT INTO reports (id, title, date_label, relevance, flags, summary, payload, generated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title, date_label = EXCLUDED.date_label, relevance = EXCLUDED.relevance,
         flags = EXCLUDED.flags, summary = EXCLUDED.summary, payload = EXCLUDED.payload,
         generated_at = EXCLUDED.generated_at`,
      [pulse.id, pulse.title, pulse.date, pulse.relevance, pulse.flags, pulse.summary, JSON.stringify(scan), scan.generatedAt],
    )
  }, undefined)
}

export type ReportSummary = {
  id: string
  title: string
  date: string
  relevance: number
  flags: number
  summary: string
  generatedAt: string
}

export async function listReports(): Promise<ReportSummary[]> {
  return withDb(async () => {
    const r = await query<{
      id: string
      title: string
      date_label: string
      relevance: number
      flags: number
      summary: string
      generated_at: Date
    }>(`SELECT id, title, date_label, relevance, flags, summary, generated_at FROM reports ORDER BY generated_at DESC LIMIT 30`)
    return r.rows.map((x) => ({
      id: x.id,
      title: x.title,
      date: x.date_label,
      relevance: x.relevance,
      flags: x.flags,
      summary: x.summary,
      generatedAt: x.generated_at.toISOString(),
    }))
  }, [])
}

export async function getReport(id: string): Promise<ScanResult | null> {
  return withDb(async () => {
    const r = await query<{ payload: ScanResult }>(`SELECT payload FROM reports WHERE id = $1`, [id])
    return r.rows[0]?.payload ?? null
  }, null)
}
