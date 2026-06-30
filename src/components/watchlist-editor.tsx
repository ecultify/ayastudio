"use client"

import { useState } from "react"
import { Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

type Creator = { id: string; handle: string; name: string; note: string; followers: string }

export function WatchlistEditor({ initial }: { initial: Creator[] }) {
  const [creators, setCreators] = useState<Creator[]>(initial)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: "", handle: "", note: "", followers: "" })
  const [saving, setSaving] = useState(false)

  async function add() {
    if (!form.name.trim() || !form.handle.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok && data.creator) {
        setCreators((c) => [...c, data.creator])
        setForm({ name: "", handle: "", note: "", followers: "" })
        setAdding(false)
      } else {
        alert(data.error || "Could not add creator")
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    setCreators((c) => c.filter((x) => x.id !== id))
    await fetch(`/api/watchlist?id=${id}`, { method: "DELETE" })
  }

  const input =
    "border-input focus-visible:ring-ring/30 w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        These creators feed Anya&apos;s positioning — they appear in the weekly Pulse and ground her chat &amp; content for benchmarking.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {creators.map((w) => (
          <div key={w.id} className="bg-muted/40 group flex items-center gap-3 rounded-lg border p-3">
            <Avatar className="border"><AvatarFallback>{w.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{w.name}</p>
              <p className="text-muted-foreground truncate text-xs">{w.handle} · {w.note}</p>
            </div>
            {w.followers && w.followers !== "—" && <span className="text-muted-foreground text-xs tabular-nums">{w.followers}</span>}
            <button
              onClick={() => remove(w.id)}
              className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition group-hover:opacity-100"
              aria-label="Remove creator"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Add a creator</h4>
            <button onClick={() => setAdding(false)} aria-label="Cancel" className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className={input} placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className={input} placeholder="@handle" value={form.handle} onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))} />
            <input className={input} placeholder="Note (e.g. Mumbai producer-DJ)" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            <input className={input} placeholder="Followers (e.g. 2M, optional)" value={form.followers} onChange={(e) => setForm((f) => ({ ...f, followers: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" disabled={saving || !form.name.trim() || !form.handle.trim()} onClick={add}>
              {saving ? "Adding…" : "Add creator"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Add creator
        </Button>
      )}
    </div>
  )
}
