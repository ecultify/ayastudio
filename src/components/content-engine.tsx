"use client"

import { useState } from "react"
import { Sparkles, Copy, Check, Wand2, Instagram, Youtube } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { CONTENT_PILLARS } from "@/lib/persona"

type Idea = { pillar: string; format: string; hook: string; platform: string; relevance: number }

export function ContentEngine() {
  const [platform, setPlatform] = useState<"Instagram" | "YouTube">("Instagram")
  const [pillar, setPillar] = useState<string | null>(null)
  const [brief, setBrief] = useState("A launch reel introducing Anya in her Bandra studio. Witty, music-first, under 15s.")
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<number | null>(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, pillar, brief }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generation failed")
      setIdeas(data.ideas || [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function copy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(i)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wand2 className="text-primary size-4" /> Generate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Platform</label>
            <div className="flex gap-2">
              <Button variant={platform === "Instagram" ? "outline" : "ghost"} size="sm" className="flex-1" onClick={() => setPlatform("Instagram")}>
                <Instagram className="size-4" /> Instagram
              </Button>
              <Button variant={platform === "YouTube" ? "outline" : "ghost"} size="sm" className="flex-1" onClick={() => setPlatform("YouTube")}>
                <Youtube className="size-4" /> YouTube
              </Button>
            </div>
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Pillar (optional)</label>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_PILLARS.map((p) => (
                <button key={p.name} onClick={() => setPillar(pillar === p.name ? null : p.name)}>
                  <Badge variant={pillar === p.name ? "default" : "secondary"} className="cursor-pointer">{p.name}</Badge>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Brief</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              className="border-input placeholder:text-muted-foreground focus-visible:ring-ring/30 min-h-24 w-full rounded-md border bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              placeholder="e.g. a launch reel that introduces Anya as a Mumbai DJ, witty and music-first…"
            />
          </div>
          <Button className="w-full" onClick={generate} disabled={loading}>
            <Sparkles className="size-4" /> {loading ? "Generating…" : "Generate direction"}
          </Button>
          {error && <p className="text-destructive text-xs">{error}</p>}
        </CardContent>
      </Card>

      <div className="space-y-4 lg:col-span-2">
        {loading && ideas.length === 0 ? (
          [0, 1, 2].map((i) => (
            <Card key={i}><CardContent className="py-5"><div className="bg-muted h-20 animate-pulse rounded" /></CardContent></Card>
          ))
        ) : ideas.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-16 text-center text-sm">
              Set a platform, pillar and brief, then generate ideas grounded in this week&apos;s live trends.
            </CardContent>
          </Card>
        ) : (
          ideas.map((c, i) => (
            <Card key={i}>
              <CardContent className="py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="acid">{c.format}</Badge>
                      <Badge variant="outline">{c.pillar}</Badge>
                    </div>
                    <p className="text-lg leading-snug">&ldquo;{c.hook}&rdquo;</p>
                    <p className="text-muted-foreground mt-2 text-xs">Suggested for {c.platform} · fit score {c.relevance}/100</p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => copy(c.hook, i)} aria-label="Copy hook">
                    {copied === i ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
                  </Button>
                </div>
                <div className="mt-3"><Progress value={c.relevance} /></div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
