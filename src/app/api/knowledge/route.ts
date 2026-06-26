import { analyzeFile } from "@/lib/knowledge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TEXT_EXTENSIONS = [
  "txt", "md", "markdown", "csv", "tsv", "json", "xml", "html", "htm",
  "js", "ts", "tsx", "jsx", "css", "yml", "yaml", "srt", "vtt", "rtf",
]
const MAX_TEXT_CHARS = 6000

function isTextual(name: string, mime: string): boolean {
  if (mime.startsWith("text/")) return true
  if (["application/json", "application/xml", "application/csv", "application/x-yaml"].includes(mime)) return true
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  return TEXT_EXTENSIONS.includes(ext)
}

/**
 * Accept a file upload (multipart) and return an AI categorization + usefulness rating.
 * Also accepts a JSON body to re-tag an already-analyzed file from its metadata + a new note
 * (used when the original File is no longer in memory, e.g. after a page reload).
 */
export async function POST(req: Request) {
  try {
    const isJson = (req.headers.get("content-type") || "").includes("application/json")

    let name: string
    let mime: string
    let size: number
    let note: string | undefined
    let force: boolean
    let priorSummary: string | undefined
    let priorCategory: string | undefined
    let text: string | undefined
    let imageDataUrl: string | undefined

    if (isJson) {
      // Re-tag path: no file bytes, refine from metadata + the uploader's note.
      const body = await req.json()
      name = String(body.name ?? "file")
      mime = String(body.mime ?? "")
      size = Number(body.size) || 0
      note = body.note || undefined
      force = body.force === true || body.force === "true"
      priorSummary = body.priorSummary || undefined
      priorCategory = body.priorCategory || undefined
    } else {
      const form = await req.formData()
      const file = form.get("file")
      if (!(file instanceof File)) {
        return Response.json({ error: "No file provided" }, { status: 400 })
      }
      name = file.name
      mime = file.type || ""
      size = file.size
      note = (form.get("note") as string) || undefined
      force = form.get("force") === "true"
      priorSummary = (form.get("priorSummary") as string) || undefined
      priorCategory = (form.get("priorCategory") as string) || undefined

      if (mime.startsWith("image/")) {
        const buf = Buffer.from(await file.arrayBuffer())
        imageDataUrl = `data:${mime};base64,${buf.toString("base64")}`
      } else if (isTextual(name, mime)) {
        text = (await file.text()).slice(0, MAX_TEXT_CHARS)
      }
    }

    // No readable content (e.g. PPTX/PDF/binary) and no user description yet:
    // ask the uploader what it is so we can categorize it accurately.
    const hasContent = !!text || !!imageDataUrl
    if (!hasContent && !note && !force) {
      return Response.json({
        needsInfo: true,
        question: `I can't read the contents of "${name}" (a ${mime || "binary"} file). In a sentence, what is it and how should Aya use it?`,
      })
    }

    const result = await analyzeFile({ name, mime, size, text, imageDataUrl, note, priorSummary, priorCategory })
    const { confident, question, ...analysis } = result

    // Ask the uploader before committing when the model isn't confident, or when
    // an image lands as "Other"/"Low" — a random image should be explained, not guessed.
    const isImage = !!imageDataUrl
    const lowValueImage = isImage && (analysis.category === "Other" || analysis.usefulness === "Low")
    if (!note && !force && (!confident || lowValueImage)) {
      const fallback = isImage
        ? `What is this image supposed to be, and how should Aya use it?`
        : `What is "${name}" and how should Aya use it?`
      return Response.json({ needsInfo: true, question: question || fallback })
    }

    return Response.json({ analysis })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
