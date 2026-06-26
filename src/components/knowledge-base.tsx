"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { UploadCloud, FileText, Image as ImageIcon, File as FileIcon, Trash2, Loader2, AlertTriangle, HelpCircle, X, Tag } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { KB_CATEGORIES } from "@/lib/knowledge"

type Status = "analyzing" | "needs-info" | "done" | "error"
type KbItem = {
  id: string
  name: string
  type: string
  size: number
  uploadedAt: string
  status: Status
  thumb?: string
  question?: string
  title?: string
  tag?: string
  category?: string
  usefulness?: "High" | "Medium" | "Low"
  score?: number
  summary?: string
  reason?: string
  error?: string
}

const STORAGE_KEY = "aya-knowledge"

function fmtSize(n: number) {
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(1) + " MB"
  if (n >= 1024) return Math.round(n / 1024) + " KB"
  return n + " B"
}
function fileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon
  if (type.startsWith("text/") || type.includes("json") || type.includes("pdf")) return FileText
  return FileIcon
}
function usefulnessVariant(u?: string): "success" | "warning" | "danger" | "secondary" {
  if (u === "High") return "success"
  if (u === "Medium") return "warning"
  if (u === "Low") return "danger"
  return "secondary"
}

/** Downscaled thumbnail (data URL) for image files, so the library shows previews. */
function makeThumb(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(undefined)
    const reader = new FileReader()
    reader.onload = () => {
      const img = new window.Image()
      img.onload = () => {
        const max = 320
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        if (!ctx) return resolve(undefined)
        ctx.drawImage(img, 0, 0, w, h)
        try {
          resolve(canvas.toDataURL("image/jpeg", 0.6))
        } catch {
          resolve(undefined)
        }
      }
      img.onerror = () => resolve(undefined)
      img.src = reader.result as string
    }
    reader.onerror = () => resolve(undefined)
    reader.readAsDataURL(file)
  })
}

export function KnowledgeBase() {
  const [items, setItems] = useState<KbItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [filter, setFilter] = useState<string>("All")
  const [infoItem, setInfoItem] = useState<KbItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // Keep the actual File objects so we can re-analyze with a user description.
  const filesRef = useRef<Record<string, File>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setItems(JSON.parse(raw))
    } catch {
      /* ignore */
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(items.filter((i) => i.status !== "analyzing")))
  }, [items, loaded])

  // Surface the next file that needs a description (one dialog at a time).
  useEffect(() => {
    if (!infoItem) {
      const next = items.find((i) => i.status === "needs-info")
      if (next) setInfoItem(next)
    } else {
      // keep the dialog's item in sync, or close it if it's no longer waiting
      const current = items.find((i) => i.id === infoItem.id)
      if (!current || current.status !== "needs-info") setInfoItem(null)
    }
  }, [items, infoItem])

  function patch(id: string, p: Partial<KbItem>) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i)))
  }

  /** Upload + analyze one file. Optionally include a user description, or force a best-effort guess. */
  async function analyze(id: string, opts: { note?: string; force?: boolean } = {}) {
    const file = filesRef.current[id]
    if (!file) return
    patch(id, { status: "analyzing", question: undefined })
    try {
      const fd = new FormData()
      fd.append("file", file)
      if (opts.note) fd.append("note", opts.note)
      if (opts.force) fd.append("force", "true")
      const res = await fetch("/api/knowledge", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Analysis failed")
      if (data.needsInfo) {
        patch(id, { status: "needs-info", question: data.question })
        return
      }
      patch(id, { status: "done", ...data.analysis })
      // Keep the File in memory so the user can re-tag with full (vision) context this session.
    } catch (e) {
      patch(id, { status: "error", error: (e as Error).message })
    }
  }

  /** Re-run analysis on an already-categorised file using the uploader's tag/description. */
  async function retag(id: string, note: string) {
    const item = items.find((i) => i.id === id)
    if (!item) return
    patch(id, { status: "analyzing", tag: note })
    try {
      const file = filesRef.current[id]
      let res: Response
      if (file) {
        // Still have the bytes — re-read with full content (vision for images).
        const fd = new FormData()
        fd.append("file", file)
        fd.append("note", note)
        fd.append("force", "true")
        if (item.summary) fd.append("priorSummary", item.summary)
        if (item.category) fd.append("priorCategory", item.category)
        res = await fetch("/api/knowledge", { method: "POST", body: fd })
      } else {
        // File gone (e.g. after reload) — refine from stored metadata + the note.
        res = await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: item.name,
            mime: item.type,
            size: item.size,
            note,
            force: true,
            priorSummary: item.summary,
            priorCategory: item.category,
          }),
        })
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Re-tag failed")
      patch(id, { status: "done", ...data.analysis })
    } catch (e) {
      patch(id, { status: "error", error: (e as Error).message })
    }
  }

  async function handleFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const id = crypto.randomUUID()
      filesRef.current[id] = file
      setItems((list) => [
        { id, name: file.name, type: file.type || "unknown", size: file.size, uploadedAt: new Date().toISOString(), status: "analyzing" },
        ...list,
      ])
      makeThumb(file).then((thumb) => thumb && patch(id, { thumb }))
      await analyze(id)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
  }

  const pending = items.filter((i) => i.status !== "done")
  const done = items.filter((i) => i.status === "done")

  // Categories present, in canonical order, with counts.
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of done) counts.set(i.category ?? "Other", (counts.get(i.category ?? "Other") ?? 0) + 1)
    return KB_CATEGORIES.filter((c) => counts.has(c)).map((c) => ({ name: c, count: counts.get(c)! }))
  }, [done])

  const visibleItems = filter === "All" ? done : done.filter((i) => (i.category ?? "Other") === filter)

  return (
    <>
      {/* Compact upload bar (drag anywhere on it, or browse) */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 transition",
          dragging ? "border-primary bg-primary/5" : "",
        )}
      >
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <UploadCloud className="size-4" />
          <span>
            Drop files here, or{" "}
            <button onClick={() => inputRef.current?.click()} className="text-foreground font-medium underline underline-offset-2">
              browse
            </button>
          </span>
        </div>
        <span className="text-muted-foreground text-xs">Auto-categorised &amp; rated for Aya on upload</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {/* In-progress / needs-info / errored uploads */}
      {pending.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pending.map((it) => (
            <Tile
              key={it.id}
              item={it}
              onRemove={() => setItems((l) => l.filter((x) => x.id !== it.id))}
              onDescribe={() => setInfoItem(it)}
            />
          ))}
        </div>
      )}

      {done.length === 0 && pending.length === 0 ? (
        <div className="text-muted-foreground rounded-lg border py-16 text-center text-sm">
          Your library is empty. Upload references, briefs, moodboards or research to build Aya&apos;s knowledge base.
        </div>
      ) : (
        <>
          {/* Filter chips */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip active={filter === "All"} onClick={() => setFilter("All")}>All · {done.length}</Chip>
              {categories.map((c) => (
                <Chip key={c.name} active={filter === c.name} onClick={() => setFilter(c.name)}>
                  {c.name} · {c.count}
                </Chip>
              ))}
            </div>
          )}

          {/* All files side by side (category shown on each tile) */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleItems.map((it) => (
              <Tile
                key={it.id}
                item={it}
                onRemove={() => setItems((l) => l.filter((x) => x.id !== it.id))}
                onRetag={(note) => retag(it.id, note)}
              />
            ))}
          </div>
        </>
      )}

      {infoItem && (
        <NeedsInfoDialog
          item={infoItem}
          onClose={() => setInfoItem(null)}
          onCancel={() => {
            const id = infoItem.id
            setInfoItem(null)
            setItems((l) => l.filter((x) => x.id !== id))
          }}
          onSubmit={(note) => {
            const id = infoItem.id
            setInfoItem(null)
            analyze(id, { note })
          }}
          onSkip={() => {
            const id = infoItem.id
            setInfoItem(null)
            analyze(id, { force: true })
          }}
        />
      )}
    </>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

function Tile({
  item: it,
  onRemove,
  onDescribe,
  onRetag,
}: {
  item: KbItem
  onRemove: () => void
  onDescribe?: () => void
  onRetag?: (note: string) => void
}) {
  const Icon = fileIcon(it.type)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const displayName = it.title || it.name

  function openEditor() {
    setDraft(it.tag ?? "")
    setEditing(true)
  }
  function save() {
    const note = draft.trim()
    if (!note) return
    setEditing(false)
    onRetag?.(note)
  }

  return (
    <div className="group bg-card relative flex flex-col overflow-hidden rounded-lg border">
      {/* preview */}
      {it.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={it.thumb} alt={displayName} className="h-28 w-full object-cover" />
      ) : (
        <div className="bg-muted/40 flex h-28 items-center justify-center">
          <Icon className="text-muted-foreground size-8" />
        </div>
      )}

      <button
        onClick={onRemove}
        className="bg-background/80 text-muted-foreground hover:text-destructive absolute top-1.5 right-1.5 rounded p-1 opacity-0 backdrop-blur transition group-hover:opacity-100"
        aria-label="Remove file"
      >
        <Trash2 className="size-3.5" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <p className="truncate text-sm font-medium" title={it.name}>{displayName}</p>

        {it.status === "analyzing" && (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <Loader2 className="size-3.5 animate-spin" /> Analysing…
          </span>
        )}
        {it.status === "needs-info" && (
          <button
            onClick={onDescribe}
            className="text-foreground hover:bg-muted -mx-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs font-medium"
          >
            <HelpCircle className="text-primary size-3.5 shrink-0" /> Tell Aya what this is
          </button>
        )}
        {it.status === "error" && (
          <span className="text-destructive inline-flex items-center gap-1 text-xs">
            <AlertTriangle className="size-3.5" /> {it.error}
          </span>
        )}
        {it.status === "done" && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {it.category && <Badge variant="outline">{it.category}</Badge>}
              {it.usefulness && <Badge variant={usefulnessVariant(it.usefulness)}>{it.usefulness} fit · {it.score}/100</Badge>}
              {it.tag && <Badge variant="acid" className="gap-1"><Tag className="size-3" />{it.tag}</Badge>}
            </div>
            {it.summary && <p className="text-foreground/90 text-xs leading-snug">{it.summary}</p>}
            {it.reason && <p className="text-muted-foreground text-[11px] leading-snug">Why for Aya: {it.reason}</p>}

            {editing ? (
              <div className="mt-1 space-y-1.5">
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save()
                    if (e.key === "Escape") setEditing(false)
                  }}
                  placeholder="What is this for? e.g. Neon nightlife colour palette for Reels covers"
                  className="border-input focus-visible:ring-ring/30 min-h-16 w-full rounded-md border bg-card px-2 py-1.5 text-xs outline-none focus-visible:ring-[3px]"
                />
                <div className="flex items-center justify-end gap-1.5">
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button size="sm" className="h-7 px-2 text-xs" disabled={!draft.trim()} onClick={save}>
                    Save &amp; re-analyse
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={openEditor}
                className="text-muted-foreground hover:bg-muted hover:text-foreground -mx-1 mt-0.5 inline-flex w-fit items-center gap-1.5 rounded px-1 py-0.5 text-xs font-medium transition"
              >
                <Tag className="size-3.5 shrink-0" /> {it.tag ? "Edit tag" : "Add tag"}
              </button>
            )}
          </>
        )}

        <p className="text-muted-foreground/70 mt-auto truncate pt-1 text-[11px]">{fmtSize(it.size)}</p>
      </div>
    </div>
  )
}

function NeedsInfoDialog({
  item,
  onSubmit,
  onSkip,
  onClose,
  onCancel,
}: {
  item: KbItem
  onSubmit: (note: string) => void
  onSkip: () => void
  onClose: () => void
  onCancel: () => void
}) {
  const [note, setNote] = useState("")
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-card relative w-full max-w-md space-y-4 rounded-xl border p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onCancel}
          aria-label="Cancel upload"
          className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-3 right-3 rounded-md p-1.5 transition"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-start gap-3 pr-8">
          <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <HelpCircle className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">A quick question from Aya</h3>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{item.name}</p>
          </div>
        </div>

        <p className="text-sm">{item.question}</p>

        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. A pitch deck for Aya's launch campaign with the visual direction and brand pillars."
          className="border-input focus-visible:ring-ring/30 min-h-24 w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
        />

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip}>Skip — guess from name</Button>
          <Button size="sm" disabled={!note.trim()} onClick={() => onSubmit(note.trim())}>
            Categorise
          </Button>
        </div>
      </div>
    </div>
  )
}
