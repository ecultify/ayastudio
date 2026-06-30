import "server-only"
import { query, withDb } from "./index"

export type KbFolder = {
  id: string
  name: string
  description: string
  kind: string
  createdAt: string
}

export type KbFile = {
  id: string
  folderId: string | null
  name: string
  title: string
  tag: string
  category: string
  usefulness: string
  score: number
  summary: string
  reason: string
  mime: string
  size: number
  contentText: string
  thumb: string | null
  kind: string // "file" | "note"
  derivedFrom: string | null
  uploadedAt: string
}

type FolderRow = {
  id: string
  name: string
  description: string
  kind: string
  created_at: Date
}
type FileRow = {
  id: string
  folder_id: string | null
  name: string
  title: string
  tag: string
  category: string
  usefulness: string
  score: number
  summary: string
  reason: string
  mime: string
  size: string
  content_text: string
  thumb: string | null
  kind: string
  derived_from: string | null
  uploaded_at: Date
}

function mapFolder(r: FolderRow): KbFolder {
  return { id: r.id, name: r.name, description: r.description, kind: r.kind, createdAt: r.created_at.toISOString() }
}
function mapFile(r: FileRow): KbFile {
  return {
    id: r.id,
    folderId: r.folder_id,
    name: r.name,
    title: r.title,
    tag: r.tag,
    category: r.category,
    usefulness: r.usefulness,
    score: r.score,
    summary: r.summary,
    reason: r.reason,
    mime: r.mime,
    size: Number(r.size),
    contentText: r.content_text,
    thumb: r.thumb,
    kind: r.kind,
    derivedFrom: r.derived_from,
    uploadedAt: r.uploaded_at.toISOString(),
  }
}

export async function listFolders(): Promise<KbFolder[]> {
  return withDb(async () => {
    const r = await query<FolderRow>(`SELECT * FROM kb_folders ORDER BY created_at ASC`)
    return r.rows.map(mapFolder)
  }, [])
}

/** Files WITHOUT their (potentially large) content_text — for listing the library. */
export async function listFiles(): Promise<KbFile[]> {
  return withDb(async () => {
    const r = await query<FileRow>(
      `SELECT id, folder_id, name, title, tag, category, usefulness, score, summary, reason,
              mime, size, '' AS content_text, thumb, kind, derived_from, uploaded_at
         FROM kb_files ORDER BY uploaded_at DESC`,
    )
    return r.rows.map(mapFile)
  }, [])
}

export async function createFolder(input: {
  name: string
  description?: string
  kind?: string
}): Promise<KbFolder | null> {
  return withDb(async () => {
    const id = crypto.randomUUID()
    const r = await query<FolderRow>(
      `INSERT INTO kb_folders (id, name, description, kind) VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, input.name.slice(0, 120), (input.description ?? "").slice(0, 400), input.kind ?? "ai"],
    )
    return mapFolder(r.rows[0])
  }, null)
}

export async function insertFile(input: {
  folderId?: string | null
  name: string
  title?: string
  tag?: string
  category?: string
  usefulness?: string
  score?: number
  summary?: string
  reason?: string
  mime?: string
  size?: number
  contentText?: string
  thumb?: string | null
  kind?: string
  derivedFrom?: string | null
}): Promise<KbFile | null> {
  return withDb(async () => {
    const id = crypto.randomUUID()
    const r = await query<FileRow>(
      `INSERT INTO kb_files
         (id, folder_id, name, title, tag, category, usefulness, score, summary, reason,
          mime, size, content_text, thumb, kind, derived_from)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        id,
        input.folderId ?? null,
        input.name.slice(0, 300),
        (input.title ?? "").slice(0, 200),
        (input.tag ?? "").slice(0, 60),
        input.category ?? "Other",
        input.usefulness ?? "Medium",
        Math.round(input.score ?? 50),
        (input.summary ?? "").slice(0, 600),
        (input.reason ?? "").slice(0, 400),
        input.mime ?? "",
        input.size ?? 0,
        input.contentText ?? "",
        input.thumb ?? null,
        input.kind ?? "file",
        input.derivedFrom ?? null,
      ],
    )
    return mapFile(r.rows[0])
  }, null)
}

export async function deleteFile(id: string): Promise<void> {
  await withDb(async () => {
    await query(`DELETE FROM kb_files WHERE id = $1`, [id])
  }, undefined)
}

export async function deleteFolder(id: string): Promise<void> {
  await withDb(async () => {
    // ON DELETE CASCADE removes the folder's files too.
    await query(`DELETE FROM kb_folders WHERE id = $1`, [id])
  }, undefined)
}

export async function getFile(id: string): Promise<KbFile | null> {
  return withDb(async () => {
    const r = await query<FileRow>(`SELECT * FROM kb_files WHERE id = $1`, [id])
    return r.rows[0] ? mapFile(r.rows[0]) : null
  }, null)
}

/** Update an existing file's AI analysis fields (used by re-tag). */
export async function updateFileAnalysis(
  id: string,
  patch: {
    title?: string
    tag?: string
    category?: string
    usefulness?: string
    score?: number
    summary?: string
    reason?: string
  },
): Promise<void> {
  await withDb(async () => {
    await query(
      `UPDATE kb_files SET
         title = COALESCE($2, title), tag = COALESCE($3, tag), category = COALESCE($4, category),
         usefulness = COALESCE($5, usefulness), score = COALESCE($6, score),
         summary = COALESCE($7, summary), reason = COALESCE($8, reason)
       WHERE id = $1`,
      [
        id,
        patch.title ?? null,
        patch.tag ?? null,
        patch.category ?? null,
        patch.usefulness ?? null,
        patch.score ?? null,
        patch.summary ?? null,
        patch.reason ?? null,
      ],
    )
  }, undefined)
}

export async function getFileContent(id: string): Promise<string | null> {
  return withDb(async () => {
    const r = await query<{ content_text: string }>(`SELECT content_text FROM kb_files WHERE id = $1`, [id])
    return r.rows[0]?.content_text ?? null
  }, null)
}

/**
 * A compact digest of the knowledge base for grounding LLM prompts across the
 * app (chat, content engine, Pulse). Includes titles, categories, summaries,
 * and a slice of the most useful notes' actual content.
 */
export async function knowledgeDigest(opts: { maxChars?: number } = {}): Promise<string> {
  const maxChars = opts.maxChars ?? 6000
  return withDb(async () => {
    const r = await query<FileRow>(
      `SELECT id, folder_id, name, title, tag, category, usefulness, score, summary, reason,
              mime, size, content_text, thumb, kind, derived_from, uploaded_at
         FROM kb_files
        ORDER BY (usefulness='High') DESC, score DESC, uploaded_at DESC
        LIMIT 40`,
    )
    if (r.rows.length === 0) return ""
    const files = r.rows.map(mapFile)
    const lines: string[] = []
    for (const f of files) {
      const label = f.title || f.name
      lines.push(`- ${label} [${f.category}, ${f.usefulness} fit] — ${f.summary}`)
    }
    let header = `KNOWLEDGE BASE (${files.length} items shaping Anya):\n${lines.join("\n")}`

    // Append the actual text of the highest-value notes/docs until we hit the budget.
    const withText = files.filter((f) => f.contentText && f.contentText.trim().length > 0)
    const excerpts: string[] = []
    let used = header.length
    for (const f of withText) {
      const remaining = maxChars - used
      if (remaining < 400) break
      const snippet = f.contentText.slice(0, Math.min(1400, remaining - 100))
      const block = `\n\n### ${f.title || f.name}\n${snippet}`
      excerpts.push(block)
      used += block.length
    }
    if (excerpts.length) header += `\n\nKEY SOURCE EXCERPTS:${excerpts.join("")}`
    return header.slice(0, maxChars)
  }, "")
}
