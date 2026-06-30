import "server-only"
import { query, withDb } from "./index"

export type CalEvent = {
  id: string
  date: string
  title: string
  format: string
  pillar: string
  status: string
}

type Row = { id: string; date: string; title: string; format: string; pillar: string; status: string }

export async function listEvents(): Promise<CalEvent[]> {
  return withDb(async () => {
    const r = await query<Row>(`SELECT id, date, title, format, pillar, status FROM calendar_events ORDER BY date ASC`)
    return r.rows
  }, [])
}

export async function upsertEvent(e: CalEvent): Promise<void> {
  await withDb(async () => {
    await query(
      `INSERT INTO calendar_events (id, date, title, format, pillar, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET
         date = EXCLUDED.date, title = EXCLUDED.title, format = EXCLUDED.format,
         pillar = EXCLUDED.pillar, status = EXCLUDED.status`,
      [e.id, e.date, e.title.slice(0, 200), e.format, e.pillar, e.status],
    )
  }, undefined)
}

export async function insertEvents(events: CalEvent[]): Promise<void> {
  await withDb(async () => {
    for (const e of events) {
      await query(
        `INSERT INTO calendar_events (id, date, title, format, pillar, status) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO NOTHING`,
        [e.id, e.date, e.title.slice(0, 200), e.format, e.pillar, e.status],
      )
    }
  }, undefined)
}

export async function deleteEvent(id: string): Promise<void> {
  await withDb(async () => {
    await query(`DELETE FROM calendar_events WHERE id = $1`, [id])
  }, undefined)
}
