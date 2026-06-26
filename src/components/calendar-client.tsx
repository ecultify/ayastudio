"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Plus, Sparkles, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CalEvent = {
  id: string
  date: string // YYYY-MM-DD
  title: string
  format: string
  pillar: string
  status: string
}

const STORAGE_KEY = "aya-calendar-events"
const FORMATS = ["Reel", "Carousel", "Static"]
const STATUSES = ["Planned", "Draft", "Needs ref"]
const PILLARS = [
  "Sound of Mumbai",
  "Studio / Producer",
  "Nightlife / DJ",
  "Style / Identity",
  "Match-Night Culture",
  "Community / Trends",
]
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const addDays = (d: Date, n: number) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const sameISO = (a: Date, b: Date) => toISO(a) === toISO(b)

export function CalendarClient() {
  const today = useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  const [events, setEvents] = useState<CalEvent[]>([])
  const [loaded, setLoaded] = useState(false)
  const [cursor, setCursor] = useState(() => new Date())
  const [editing, setEditing] = useState<CalEvent | null>(null)
  const [generating, setGenerating] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)

  // Load persisted events (client-only; no DB yet).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setEvents(JSON.parse(raw))
    } catch {
      /* ignore */
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
  }, [events, loaded])

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  // Only render the weeks the month actually spans (5 or 6), not a fixed 6.
  const weeks = Math.ceil((monthStart.getDay() + daysInMonth) / 7)
  const gridStart = addDays(monthStart, -monthStart.getDay())
  const days = useMemo(() => Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i)), [gridStart.getTime(), weeks])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {}
    for (const e of events) (map[e.date] ??= []).push(e)
    return map
  }, [events])

  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })

  function upsert(ev: CalEvent) {
    setEvents((list) => {
      const idx = list.findIndex((e) => e.id === ev.id)
      if (idx >= 0) {
        const copy = list.slice()
        copy[idx] = ev
        return copy
      }
      return [...list, ev]
    })
  }
  const remove = (id: string) => setEvents((l) => l.filter((e) => e.id !== id))
  const move = (id: string, date: string) => setEvents((l) => l.map((e) => (e.id === id ? { ...e, date } : e)))

  async function generate() {
    setGenerating(true)
    try {
      const res = await fetch("/api/content-plan", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate plan")
      const base = new Date()
      base.setHours(0, 0, 0, 0)
      const created: CalEvent[] = (data.posts || []).map((p: { title: string; format: string; pillar: string; status: string; dayOffset: number }) => ({
        id: crypto.randomUUID(),
        date: toISO(addDays(base, p.dayOffset || 0)),
        title: p.title,
        format: p.format,
        pillar: p.pillar,
        status: p.status,
      }))
      setEvents((l) => [...l, ...created])
      setCursor(new Date())
    } catch (e) {
      alert("Generate failed: " + (e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  function newEventOn(iso: string): CalEvent {
    return { id: crypto.randomUUID(), date: iso, title: "", format: "Reel", pillar: PILLARS[0], status: "Planned" }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month">
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="ml-1 text-lg font-semibold">{monthLabel}</h2>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Today</Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={generate} disabled={generating}>
            <Sparkles className="size-4" /> {generating ? "Generating…" : "Generate from trends"}
          </Button>
          <Button size="sm" onClick={() => setEditing(newEventOn(toISO(today)))}>
            <Plus className="size-4" /> Add post
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-xs">
        <span>Drag posts between days to reschedule.</span>
        <span className="flex items-center gap-1.5"><span className="bg-primary size-2 rounded-full" /> Planned</span>
        <span className="flex items-center gap-1.5"><span className="bg-muted-foreground/40 size-2 rounded-full" /> Draft</span>
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400" /> Needs ref</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="grid shrink-0 grid-cols-7 border-b">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-muted-foreground bg-muted/40 px-2 py-2 text-center text-[11px] font-medium tracking-wide uppercase">
              {w}
            </div>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const iso = toISO(d)
            const inMonth = d.getMonth() === cursor.getMonth()
            const isToday = sameISO(d, today)
            const dayEvents = eventsByDate[iso] ?? []
            return (
              <div
                key={iso}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData("text/plain") || dragId
                  if (id) move(id, iso)
                  setDragId(null)
                }}
                className={cn(
                  "group flex min-h-0 flex-col border-r border-b p-1.5 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-muted/20",
                )}
              >
                <div className="mb-1 flex shrink-0 items-center justify-between">
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center text-xs tabular-nums",
                      isToday && "bg-primary text-primary-foreground rounded-full font-medium",
                      !inMonth && !isToday && "text-muted-foreground/50",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <button
                    onClick={() => setEditing(newEventOn(iso))}
                    className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-0.5 opacity-0 transition group-hover:opacity-100"
                    aria-label="Add post"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
                  {dayEvents.map((ev) => (
                    <button
                      key={ev.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", ev.id)
                        setDragId(ev.id)
                      }}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => setEditing(ev)}
                      className={cn(
                        "block w-full cursor-grab rounded border-l-2 bg-card px-1.5 py-1 text-left text-[11px] shadow-xs active:cursor-grabbing",
                        ev.status === "Planned" && "border-l-primary",
                        ev.status === "Draft" && "border-l-muted-foreground/40",
                        ev.status === "Needs ref" && "border-l-amber-400",
                        dragId === ev.id && "opacity-50",
                      )}
                    >
                      <span className="block truncate font-medium">{ev.title || "Untitled"}</span>
                      <span className="text-muted-foreground block truncate">{ev.format} · {ev.pillar}</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {editing && (
        <EventModal
          event={editing}
          isNew={!events.some((e) => e.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(ev) => {
            upsert(ev)
            setEditing(null)
          }}
          onDelete={(id) => {
            remove(id)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function EventModal({
  event,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  event: CalEvent
  isNew: boolean
  onSave: (e: CalEvent) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const [form, setForm] = useState<CalEvent>(event)
  const set = (patch: Partial<CalEvent>) => setForm((f) => ({ ...f, ...patch }))
  const selectCls =
    "border-input focus-visible:ring-ring/30 w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-md space-y-4 rounded-xl border p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold">{isNew ? "Add post" : "Edit post"}</h3>

        <div>
          <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Title</label>
          <input autoFocus value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Apartment console mix" className={selectCls} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Date</label>
            <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className={selectCls} />
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Format</label>
            <select value={form.format} onChange={(e) => set({ format: e.target.value })} className={selectCls}>
              {FORMATS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Pillar</label>
            <select value={form.pillar} onChange={(e) => set({ pillar: e.target.value })} className={selectCls}>
              {PILLARS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Status</label>
            <select value={form.status} onChange={(e) => set({ status: e.target.value })} className={selectCls}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div>
            {!isNew && (
              <Button variant="ghost" size="sm" onClick={() => onDelete(form.id)} className="text-destructive hover:text-destructive">
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => onSave({ ...form, title: form.title.trim() || "Untitled" })}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
