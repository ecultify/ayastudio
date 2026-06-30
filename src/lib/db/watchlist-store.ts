import "server-only"
import { query, withDb } from "./index"

export type Creator = { id: string; handle: string; name: string; note: string; followers: string }

// Default creators Anya benchmarks against — seeded into the DB on first run.
const DEFAULT_WATCHLIST: Omit<Creator, "id">[] = [
  { handle: "@kayan.a", name: "Kayan / Ambika Nayak", note: "Mumbai producer-DJ + fashion", followers: "—" },
  { handle: "@dj_rihya", name: "DJ Rihya", note: "Mass Indian crowd energy", followers: "2M" },
  { handle: "@jyoty", name: "Jyoty", note: "South Asian global tastemaker", followers: "—" },
  { handle: "@peggygou_", name: "Peggy Gou", note: "Fashion-led global music identity", followers: "—" },
  { handle: "@naina_avtr", name: "Naina Avtr", note: "Indian AI creator benchmark", followers: "380K" },
  { handle: "@kyraonig", name: "Kyra", note: "Premium Mumbai AI lifestyle", followers: "235K" },
]

type Row = { id: string; handle: string; name: string; note: string; followers: string }

/** List the watchlist, seeding defaults the first time it's empty. */
export async function listWatchlist(): Promise<Creator[]> {
  return withDb(async () => {
    const existing = await query<Row>(`SELECT id, handle, name, note, followers FROM watchlist ORDER BY created_at ASC`)
    if (existing.rows.length > 0) return existing.rows
    // Seed defaults once.
    for (const c of DEFAULT_WATCHLIST) {
      await query(`INSERT INTO watchlist (id, handle, name, note, followers) VALUES ($1,$2,$3,$4,$5)`, [
        crypto.randomUUID(),
        c.handle,
        c.name,
        c.note,
        c.followers,
      ])
    }
    const seeded = await query<Row>(`SELECT id, handle, name, note, followers FROM watchlist ORDER BY created_at ASC`)
    return seeded.rows
  }, DEFAULT_WATCHLIST.map((c, i) => ({ id: `default-${i}`, ...c })))
}

export async function addCreator(input: {
  handle: string
  name: string
  note?: string
  followers?: string
}): Promise<Creator | null> {
  return withDb(async () => {
    const id = crypto.randomUUID()
    const handle = input.handle.startsWith("@") ? input.handle : `@${input.handle}`
    const r = await query<Row>(
      `INSERT INTO watchlist (id, handle, name, note, followers) VALUES ($1,$2,$3,$4,$5) RETURNING id, handle, name, note, followers`,
      [id, handle.slice(0, 60), input.name.slice(0, 120), (input.note ?? "").slice(0, 200), (input.followers ?? "—").slice(0, 20)],
    )
    return r.rows[0]
  }, null)
}

export async function removeCreator(id: string): Promise<void> {
  await withDb(async () => {
    await query(`DELETE FROM watchlist WHERE id = $1`, [id])
  }, undefined)
}
