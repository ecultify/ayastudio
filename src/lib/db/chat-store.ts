import "server-only"
import { query, withDb } from "./index"

export type ChatSession = { id: string; title: string; createdAt: string; updatedAt: string }
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string }

type SessionRow = { id: string; title: string; created_at: Date; updated_at: Date }
type MessageRow = { id: string; role: string; content: string; created_at: Date }

export async function listSessions(): Promise<ChatSession[]> {
  return withDb(async () => {
    const r = await query<SessionRow>(`SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT 100`)
    return r.rows.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.created_at.toISOString(),
      updatedAt: s.updated_at.toISOString(),
    }))
  }, [])
}

export async function createSession(title = "New chat"): Promise<ChatSession | null> {
  return withDb(async () => {
    const id = crypto.randomUUID()
    const r = await query<SessionRow>(
      `INSERT INTO chat_sessions (id, title) VALUES ($1, $2) RETURNING *`,
      [id, title.slice(0, 120)],
    )
    const s = r.rows[0]
    return { id: s.id, title: s.title, createdAt: s.created_at.toISOString(), updatedAt: s.updated_at.toISOString() }
  }, null)
}

export async function renameSession(id: string, title: string): Promise<void> {
  await withDb(async () => {
    await query(`UPDATE chat_sessions SET title = $2, updated_at = now() WHERE id = $1`, [id, title.slice(0, 120)])
  }, undefined)
}

export async function deleteSession(id: string): Promise<void> {
  await withDb(async () => {
    await query(`DELETE FROM chat_sessions WHERE id = $1`, [id])
  }, undefined)
}

export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  return withDb(async () => {
    const r = await query<MessageRow>(
      `SELECT id, role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC`,
      [sessionId],
    )
    return r.rows.map((m) => ({
      id: m.id,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      createdAt: m.created_at.toISOString(),
    }))
  }, [])
}

export async function addMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await withDb(async () => {
    await query(`INSERT INTO chat_messages (id, session_id, role, content) VALUES ($1,$2,$3,$4)`, [
      crypto.randomUUID(),
      sessionId,
      role,
      content,
    ])
    await query(`UPDATE chat_sessions SET updated_at = now() WHERE id = $1`, [sessionId])
  }, undefined)
}
