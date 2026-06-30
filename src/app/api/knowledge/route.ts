import { analyzeFile, proposeNotes, SPLIT_MIN_CHARS } from "@/lib/knowledge"
import { extractText, isOfficeDoc } from "@/lib/parse/extract"
import {
  listFolders,
  listFiles,
  insertFile,
  createFolder,
  deleteFile,
  deleteFolder,
  getFile,
  updateFileAnalysis,
} from "@/lib/db/knowledge-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** List the whole knowledge base (folders + files, content excluded). */
export async function GET() {
  const [folders, files] = await Promise.all([listFolders(), listFiles()])
  return Response.json({ folders, files })
}

/**
 * POST handles three things:
 *  - multipart upload  → extract text, analyze, persist, auto-split long docs
 *  - JSON { action: "retag", id, note }   → re-analyze a stored file
 *  - JSON { action: "createFolder", name } → make an empty folder
 */
export async function POST(req: Request) {
  try {
    const ctype = req.headers.get("content-type") || ""

    // ---- JSON actions ----
    if (ctype.includes("application/json")) {
      const body = await req.json()
      const action = String(body.action || "")

      if (action === "createFolder") {
        const folder = await createFolder({ name: String(body.name || "Folder"), description: body.description })
        return Response.json({ ok: true, folder })
      }

      if (action === "retag") {
        const id = String(body.id || "")
        const note = String(body.note || "")
        const file = await getFile(id)
        if (!file) return Response.json({ error: "File not found" }, { status: 404 })
        const result = await analyzeFile({
          name: file.name,
          mime: file.mime,
          size: file.size,
          text: file.contentText || undefined,
          note,
          priorSummary: file.summary,
          priorCategory: file.category,
        })
        const { confident: _c, question: _q, ...analysis } = result
        void _c
        void _q
        await updateFileAnalysis(id, { ...analysis, tag: note })
        return Response.json({ ok: true })
      }

      return Response.json({ error: "Unknown action" }, { status: 400 })
    }

    // ---- multipart upload ----
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return Response.json({ error: "No file provided" }, { status: 400 })

    const name = file.name
    const mime = file.type || ""
    const size = file.size
    const note = (form.get("note") as string) || undefined
    const force = form.get("force") === "true"
    const thumb = (form.get("thumb") as string) || null

    let text: string | undefined
    let imageDataUrl: string | undefined

    const buffer = Buffer.from(await file.arrayBuffer())
    if (mime.startsWith("image/")) {
      imageDataUrl = `data:${mime};base64,${buffer.toString("base64")}`
    } else {
      const extracted = await extractText({ name, mime, buffer })
      if (extracted.text) text = extracted.text
    }

    // Office docs we couldn't read (e.g. scanned/empty) and have no description:
    // ask the uploader what it is before committing.
    const hasContent = !!text || !!imageDataUrl
    if (!hasContent && !note && !force) {
      const kind = isOfficeDoc(name, mime) ? "document" : `${mime || "binary"} file`
      return Response.json({
        needsInfo: true,
        question: `I couldn't read the contents of "${name}" (a ${kind}). In a sentence, what is it and how should Anya use it?`,
      })
    }

    const result = await analyzeFile({
      name,
      mime,
      size,
      // Cap inline analysis text; the full text is still persisted for grounding.
      text: text ? text.slice(0, 6000) : undefined,
      imageDataUrl,
      note,
    })
    const { confident, question, ...analysis } = result

    const isImage = !!imageDataUrl
    const lowValueImage = isImage && (analysis.category === "Other" || analysis.usefulness === "Low")
    if (!note && !force && (!confident || lowValueImage)) {
      const fallback = isImage
        ? `What is this image supposed to be, and how should Anya use it?`
        : `What is "${name}" and how should Anya use it?`
      return Response.json({ needsInfo: true, question: question || fallback })
    }

    // Long documents get broken into a folder of focused notes the rest of the
    // app can read individually. The source file is filed into the same folder.
    let folderId: string | null = null
    let split: Awaited<ReturnType<typeof proposeNotes>> = null
    if (text && text.length >= SPLIT_MIN_CHARS) {
      try {
        split = await proposeNotes({ title: analysis.title || name, text })
      } catch (e) {
        console.error("[knowledge] split failed:", (e as Error).message)
      }
      if (split) {
        const folder = await createFolder({ name: split.folderName, description: split.folderDescription, kind: "ai" })
        folderId = folder?.id ?? null
      }
    }

    const parent = await insertFile({
      folderId,
      name,
      ...analysis,
      mime,
      size,
      contentText: text ?? "",
      thumb,
      kind: "file",
    })

    if (split && folderId && parent) {
      for (const n of split.notes) {
        await insertFile({
          folderId,
          name: `${n.title}.md`,
          title: n.title,
          tag: "AI note",
          category: analysis.category,
          usefulness: analysis.usefulness,
          score: analysis.score,
          summary: `Note derived from ${analysis.title || name}`,
          reason: "AI-extracted note for Anya's tools to read",
          mime: "text/markdown",
          size: n.body.length,
          contentText: n.body,
          kind: "note",
          derivedFrom: parent.id,
        })
      }
    }

    return Response.json({
      ok: true,
      split: split ? { folderName: split.folderName, notes: split.notes.length } : null,
    })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}

/** Delete a file or folder: /api/knowledge?type=file|folder&id=... */
export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const id = url.searchParams.get("id")
  const type = url.searchParams.get("type")
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 })
  if (type === "folder") await deleteFolder(id)
  else await deleteFile(id)
  return Response.json({ ok: true })
}
