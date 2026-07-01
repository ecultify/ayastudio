"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  UploadCloud, FileText, Image as ImageIcon, File as FileIcon, Trash2, Loader2,
  AlertTriangle, HelpCircle, X, Tag, Folder, FolderOpen, Sparkles, ChevronRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { KB_CATEGORIES } from "@/lib/knowledge"

type ServerFile = {
  id: string
  folderId: string | null
  name: string
  title: string
  tag: string
  category: string
  usefulness: "High" | "Medium" | "Low" | string
  score: number
  summary: string
  reason: string
  mime: string
  size: number
  thumb: string | null
  kind: string // "file" | "note"
}
type ServerFolder = { id: string; name: string; description: string; kind: string }

type Upload = {
  id: string
  name: string
  type: string
  size: number
  status: "analyzing" | "needs-info" | "error"
  thumb?: string
  question?: string
  error?: string
}

function fmtSize(n: number) {
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(1) + " MB"
  if (n >= 1024) return Math.round(n / 1024) + " KB"
  return n + " B"
}
function fileIcon(type: string, kind?: string) {
  if (kind === "note") return FileText
  if (type.startsWith("image/")) return ImageIcon
  if (type.startsWith("text/") || type.includes("json") || type.includes("pdf") || type.includes("markdown")) return FileText
  return FileIcon
}
function usefulnessVariant(u?: string): "success" | "warning" | "danger" | "secondary" {
  if (u === "High") return "success"
  if (u === "Medium") return "warning"
  if (u === "Low") return "danger"
  return "secondary"
}

/** Downscaled thumbnail (data URL) for image files. */
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
  const [folders, setFolders] = useState<ServerFolder[]>([])
  const [files, setFiles] = useState<ServerFile[]>([])
  const [uploads, setUploads] = useState<Upload[]>([])
  const [loaded, setLoaded] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [filter, setFilter] = useState<string>("All")
  const [infoItem, setInfoItem] = useState<Upload | null>(null)
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<Record<string, File>>({})

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/knowledge", { cache: "no-store" })
      const data = await res.json()
      if (res.ok) {
        setFolders(data.folders ?? [])
        setFiles(data.files ?? [])
      }
    } catch {
      /* ignore */
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Surface the next upload that needs a description (one dialog at a time).
  useEffect(() => {
    if (!infoItem) {
      const next = uploads.find((i) => i.status === "needs-info")
      if (next) setInfoItem(next)
    } else {
      const current = uploads.find((i) => i.id === infoItem.id)
      if (!current || current.status !== "needs-info") setInfoItem(null)
    }
  }, [uploads, infoItem])

  function patchUpload(id: string, p: Partial<Upload>) {
    setUploads((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i)))
  }
  function dropUpload(id: string) {
    setUploads((l) => l.filter((x) => x.id !== id))
  }

  /** Upload + analyze one file. Optionally include a description, or force a best-effort guess. */
  async function analyze(id: string, opts: { note?: string; force?: boolean } = {}) {
    const file = filesRef.current[id]
    if (!file) return
    patchUpload(id, { status: "analyzing", question: undefined })
    try {
      const fd = new FormData()
      fd.append("file", file)
      if (opts.note) fd.append("note", opts.note)
      if (opts.force) fd.append("force", "true")
      const up = uploads.find((u) => u.id === id)
      if (up?.thumb) fd.append("thumb", up.thumb)
      const res = await fetch("/api/knowledge", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Analysis failed")
      if (data.needsInfo) {
        patchUpload(id, { status: "needs-info", question: data.question })
        return
      }
      // Persisted server-side — drop the local tile and refresh the library.
      dropUpload(id)
      delete filesRef.current[id]
      await refresh()
    } catch (e) {
      patchUpload(id, { status: "error", error: (e as Error).message })
    }
  }

  async function handleFiles(fileList: FileList | File[]) {
    for (const file of Array.from(fileList)) {
      const id = crypto.randomUUID()
      filesRef.current[id] = file
      setUploads((list) => [
        { id, name: file.name, type: file.type || "unknown", size: file.size, status: "analyzing" },
        ...list,
      ])
      makeThumb(file).then((thumb) => thumb && patchUpload(id, { thumb }))
      await analyze(id)
    }
  }

  async function retag(id: string, note: string) {
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retag", id, note }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Re-tag failed")
      await refresh()
    } catch (e) {
      alert("Re-tag failed: " + (e as Error).message)
    }
  }

  async function removeFile(id: string) {
    setFiles((l) => l.filter((f) => f.id !== id))
    await fetch(`/api/knowledge?type=file&id=${id}`, { method: "DELETE" })
    refresh()
  }
  async function removeFolder(id: string) {
    setFolders((l) => l.filter((f) => f.id !== id))
    setFiles((l) => l.filter((f) => f.folderId !== id))
    await fetch(`/api/knowledge?type=folder&id=${id}`, { method: "DELETE" })
    refresh()
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
  }

  const rootFiles = useMemo(() => files.filter((f) => !f.folderId), [files])
  const filesByFolder = useMemo(() => {
    const map: Record<string, ServerFile[]> = {}
    for (const f of files) if (f.folderId) (map[f.folderId] ??= []).push(f)
    return map
  }, [files])

  // Category chips over root files only (folders shown separately).
  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const i of rootFiles) counts.set(i.category ?? "Other", (counts.get(i.category ?? "Other") ?? 0) + 1)
    return KB_CATEGORIES.filter((c) => counts.has(c)).map((c) => ({ name: c, count: counts.get(c)! }))
  }, [rootFiles])

  const visibleRoot = filter === "All" ? rootFiles : rootFiles.filter((i) => (i.category ?? "Other") === filter)
  const empty = loaded && files.length === 0 && folders.length === 0 && uploads.length === 0

  return (
    <>
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
        <span className="text-muted-foreground text-xs">
          Docs (xlsx/pptx/docx/pdf) are read &amp; split into a folder of notes for Anya
        </span>
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
      {uploads.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {uploads.map((it) => (
            <UploadTile key={it.id} item={it} onRemove={() => dropUpload(it.id)} onDescribe={() => setInfoItem(it)} />
          ))}
        </div>
      )}

      {empty ? (
        <div className="text-muted-foreground rounded-lg border py-16 text-center text-sm">
          Your library is empty. Upload references, briefs, moodboards or research to build Anya&apos;s knowledge base.
        </div>
      ) : (
        <>
          {/* AI / document folders */}
          {folders.map((folder) => {
            const items = filesByFolder[folder.id] ?? []
            const open = openFolders[folder.id] ?? true
            return (
              <div key={folder.id} className="rounded-lg border">
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <button
                    onClick={() => setOpenFolders((s) => ({ ...s, [folder.id]: !open }))}
                    className="hover:bg-muted -ml-1 flex min-w-0 flex-1 items-center gap-2.5 rounded p-1 text-left"
                  >
                    <ChevronRight className={cn("text-muted-foreground size-4 shrink-0 transition", open && "rotate-90")} />
                    {open ? <FolderOpen className="text-primary size-4 shrink-0" /> : <Folder className="text-primary size-4 shrink-0" />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{folder.name}</p>
                      {folder.description && <p className="text-muted-foreground truncate text-xs">{folder.description}</p>}
                    </div>
                  </button>
                  {folder.kind === "ai" && (
                    <Badge variant="acid" className="gap-1"><Sparkles className="size-3" /> AI</Badge>
                  )}
                  <span className="text-muted-foreground text-xs tabular-nums">{items.length}</span>
                  <button
                    onClick={() => removeFolder(folder.id)}
                    className="text-muted-foreground hover:text-destructive rounded p-1"
                    aria-label="Delete folder"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {open && items.length > 0 && (
                  <div className="grid gap-3 border-t p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((it) => (
                      <FileTile key={it.id} item={it} onRemove={() => removeFile(it.id)} onRetag={(n) => retag(it.id, n)} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Root files */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Chip active={filter === "All"} onClick={() => setFilter("All")}>All · {rootFiles.length}</Chip>
              {categories.map((c) => (
                <Chip key={c.name} active={filter === c.name} onClick={() => setFilter(c.name)}>
                  {c.name} · {c.count}
                </Chip>
              ))}
            </div>
          )}
          {visibleRoot.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleRoot.map((it) => (
                <FileTile key={it.id} item={it} onRemove={() => removeFile(it.id)} onRetag={(n) => retag(it.id, n)} />
              ))}
            </div>
          )}
        </>
      )}

      {infoItem && (
        <NeedsInfoDialog
          item={infoItem}
          onClose={() => setInfoItem(null)}
          onCancel={() => {
            dropUpload(infoItem.id)
            setInfoItem(null)
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

function UploadTile({ item, onRemove, onDescribe }: { item: Upload; onRemove: () => void; onDescribe: () => void }) {
  const Icon = fileIcon(item.type)
  return (
    <div className="group bg-card relative flex flex-col overflow-hidden rounded-lg border">
      {item.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.thumb} alt={item.name} className="h-28 w-full object-cover" />
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
        <p className="truncate text-sm font-medium" title={item.name}>{item.name}</p>
        {item.status === "analyzing" && (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <Loader2 className="size-3.5 animate-spin" /> Reading &amp; analysing…
          </span>
        )}
        {item.status === "needs-info" && (
          <button onClick={onDescribe} className="text-foreground hover:bg-muted -mx-1 inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs font-medium">
            <HelpCircle className="text-primary size-3.5 shrink-0" /> Tell Anya what this is
          </button>
        )}
        {item.status === "error" && (
          <span className="text-destructive inline-flex items-center gap-1 text-xs">
            <AlertTriangle className="size-3.5" /> {item.error}
          </span>
        )}
        <p className="text-muted-foreground/70 mt-auto truncate pt-1 text-[11px]">{fmtSize(item.size)}</p>
      </div>
    </div>
  )
}

function FileTile({ item: it, onRemove, onRetag }: { item: ServerFile; onRemove: () => void; onRetag: (note: string) => void }) {
  const Icon = fileIcon(it.mime, it.kind)
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
    onRetag(note)
  }

  return (
    <div className="group bg-card relative flex flex-col overflow-hidden rounded-lg border">
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
        <div className="flex flex-wrap items-center gap-1.5">
          {it.category && <Badge variant="outline">{it.category}</Badge>}
          {it.usefulness && <Badge variant={usefulnessVariant(it.usefulness)}>{it.usefulness} fit · {it.score}/100</Badge>}
          {it.tag && <Badge variant="acid" className="gap-1"><Tag className="size-3" />{it.tag}</Badge>}
        </div>
        {it.summary && <p className="text-foreground/90 text-xs leading-snug">{it.summary}</p>}
        {it.reason && it.kind !== "note" && <p className="text-muted-foreground text-[11px] leading-snug">Why for Anya: {it.reason}</p>}

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
              <Button size="sm" className="h-7 px-2 text-xs" disabled={!draft.trim()} onClick={save}>Save &amp; re-analyse</Button>
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
  item: Upload
  onSubmit: (note: string) => void
  onSkip: () => void
  onClose: () => void
  onCancel: () => void
}) {
  const [note, setNote] = useState("")
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-card relative w-full max-w-md space-y-4 rounded-xl border p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <button onClick={onCancel} aria-label="Cancel upload" className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-3 right-3 rounded-md p-1.5 transition">
          <X className="size-4" />
        </button>
        <div className="flex items-start gap-3 pr-8">
          <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
            <HelpCircle className="size-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">A quick question from Anya</h3>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{item.name}</p>
          </div>
        </div>
        <p className="text-sm">{item.question}</p>
        <textarea
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. A pitch deck for Anya's launch campaign with the visual direction and brand pillars."
          className="border-input focus-visible:ring-ring/30 min-h-24 w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
        />
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onSkip}>Skip — guess from name</Button>
          <Button size="sm" disabled={!note.trim()} onClick={() => onSubmit(note.trim())}>Categorise</Button>
        </div>
      </div>
    </div>
  )
}
