import "server-only"

// Office/PDF document → plain text extraction so the AI librarian can actually
// read xlsx / pptx / docx / pdf uploads (not just guess from the filename).

// File types officeparser can extract (matches its SupportedFileType, minus the
// text-ish ones we handle directly). Legacy doc/ppt/xls are not supported.
const OFFICE_FILETYPES = ["docx", "pptx", "xlsx", "pdf", "odt", "odp", "ods", "rtf"] as const
const OFFICE_EXTS: string[] = [...OFFICE_FILETYPES]

const TEXT_EXTS = [
  "txt", "md", "markdown", "csv", "tsv", "json", "xml", "html", "htm",
  "js", "ts", "tsx", "jsx", "css", "yml", "yaml", "srt", "vtt", "rtf", "log",
]

export function extOf(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? ""
}

export function isTextual(name: string, mime: string): boolean {
  if (mime.startsWith("text/")) return true
  if (["application/json", "application/xml", "application/csv", "application/x-yaml"].includes(mime)) return true
  return TEXT_EXTS.includes(extOf(name))
}

export function isOfficeDoc(name: string, mime: string): boolean {
  if (OFFICE_EXTS.includes(extOf(name))) return true
  return (
    mime.includes("officedocument") ||
    mime.includes("ms-excel") ||
    mime.includes("ms-powerpoint") ||
    mime === "application/msword" ||
    mime === "application/pdf"
  )
}

/** Map a filename/mime to officeparser's SupportedFileType, or null if unknown. */
function officeFileType(name: string, mime: string): string | null {
  const ext = extOf(name)
  if ((OFFICE_FILETYPES as readonly string[]).includes(ext)) return ext
  if (mime === "application/pdf") return "pdf"
  if (mime.includes("wordprocessingml")) return "docx"
  if (mime.includes("presentationml")) return "pptx"
  if (mime.includes("spreadsheetml")) return "xlsx"
  return null
}

export type Extracted = { text: string; method: "office" | "text" | "none" }

/**
 * Extract readable text from an uploaded file's bytes. Returns method "none"
 * when the file isn't a supported document (e.g. images, raw binaries).
 */
export async function extractText(input: { name: string; mime: string; buffer: Buffer }): Promise<Extracted> {
  const { name, mime, buffer } = input

  if (isOfficeDoc(name, mime)) {
    try {
      // Dynamic import keeps the heavy parser out of the cold path / client bundle.
      const { parseOffice } = await import("officeparser")
      // Magic-byte auto-detection is unreliable in the bundled server, so pass an
      // explicit fileType hint derived from the extension / mime.
      const fileType = officeFileType(name, mime)
      const config = fileType ? ({ fileType } as unknown as Parameters<typeof parseOffice>[1]) : undefined
      const doc = await parseOffice(buffer, config)
      const text = doc.toText().trim()
      if (text) return { text, method: "office" }
    } catch (e) {
      console.error("[parse] office extract failed:", (e as Error).message)
    }
    return { text: "", method: "none" }
  }

  if (isTextual(name, mime)) {
    return { text: buffer.toString("utf8"), method: "text" }
  }

  return { text: "", method: "none" }
}
