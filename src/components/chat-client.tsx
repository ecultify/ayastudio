"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Radio, Send, Plus, MessageSquare, Trash2, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Markdown } from "@/components/markdown"
import { cn } from "@/lib/utils"

type Msg = { role: "user" | "assistant"; content: string }
type Session = { id: string; title: string; updatedAt: string }

const SUGGESTIONS = [
  "Plan next week's reels",
  "What's trending I should jump on?",
  "Research what other Mumbai DJs are posting right now",
  "Give me three caption options for a match-night reel",
]

export function ChatClient() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions", { cache: "no-store" })
      const data = await res.json()
      if (res.ok) setSessions(data.sessions ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px"
  }, [input])

  function newChat() {
    setActiveId(null)
    setMessages([])
    setInput("")
  }

  async function openSession(id: string) {
    if (streaming) return
    setActiveId(id)
    setMessages([])
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { cache: "no-store" })
      const data = await res.json()
      if (res.ok) setMessages((data.messages ?? []).map((m: Msg) => ({ role: m.role, content: m.content })))
    } catch {
      /* ignore */
    }
  }

  async function deleteSession(id: string) {
    setSessions((s) => s.filter((x) => x.id !== id))
    if (activeId === id) newChat()
    try {
      await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" })
    } catch {
      /* ignore */
    }
  }

  async function send(text: string) {
    const content = text.trim()
    if (!content || streaming) return

    // Ensure we have a session to persist into (best-effort; chat still works if DB is down).
    let sessionId = activeId
    if (!sessionId) {
      try {
        const res = await fetch("/api/chat/sessions", { method: "POST" })
        if (res.ok) {
          const data = await res.json()
          sessionId = data.session?.id ?? null
          if (sessionId) setActiveId(sessionId)
        }
      } catch {
        /* continue without persistence */
      }
    }

    const history = [...messages, { role: "user" as const, content }]
    setMessages([...history, { role: "assistant", content: "" }])
    setInput("")
    setStreaming(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, sessionId }),
      })
      if (!res.ok || !res.body) throw new Error(await res.text())

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages((m) => {
          const copy = m.slice()
          const last = copy[copy.length - 1]
          copy[copy.length - 1] = { role: "assistant", content: last.content + chunk }
          return copy
        })
      }
    } catch (e) {
      setMessages((m) => {
        const copy = m.slice()
        copy[copy.length - 1] = { role: "assistant", content: `⚠️ ${(e as Error).message}` }
        return copy
      })
    } finally {
      setStreaming(false)
      loadSessions()
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const empty = messages.length === 0

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r md:flex">
        <div className="p-3">
          <Button className="w-full justify-start" size="sm" onClick={newChat}>
            <Plus className="size-4" /> New chat
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {sessions.length === 0 ? (
            <p className="text-muted-foreground px-2 py-4 text-xs">No saved chats yet.</p>
          ) : (
            <div className="space-y-0.5">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition",
                    activeId === s.id ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <button onClick={() => openSession(s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <MessageSquare className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="truncate">{s.title || "New chat"}</span>
                  </button>
                  <button
                    onClick={() => deleteSession(s.id)}
                    className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition group-hover:opacity-100"
                    aria-label="Delete chat"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2.5 border-b px-5">
          <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
            <Radio className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Ask Anya</div>
            <div className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <Globe className="size-3" /> Knowledge base + live signals + web research
            </div>
          </div>
          <Button variant="outline" size="sm" className="ml-auto md:hidden" onClick={newChat}>
            <Plus className="size-4" /> New
          </Button>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {empty ? (
              <div className="flex flex-col items-center gap-6 pt-[12vh] text-center">
                <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
                  <Radio className="size-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Ask Anya</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Grounded in her knowledge base &amp; this week&apos;s Pulse — and she&apos;ll research the live web when she needs to.
                  </p>
                </div>
                <div className="grid w-full gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => send(s)} className="hover:bg-muted rounded-lg border px-4 py-3 text-left text-sm transition">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((m, i) => (
                  <Message key={i} m={m} streaming={streaming && i === messages.length - 1} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t">
          <div className="mx-auto max-w-3xl px-4 py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                send(input)
              }}
              className="border-input focus-within:ring-ring/30 flex items-end gap-2 rounded-xl border bg-card p-2 shadow-xs focus-within:ring-[3px]"
            >
              <textarea
                ref={taRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask about trends, copy, schedule — or anything to research…"
                className="placeholder:text-muted-foreground max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
              />
              <Button type="submit" size="icon" disabled={!input.trim() || streaming}>
                <Send className="size-4" />
              </Button>
            </form>
            <p className="text-muted-foreground mt-1.5 text-center text-[11px]">Enter to send · Shift+Enter for a new line</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Message({ m, streaming }: { m: Msg; streaming: boolean }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
          {m.content}
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-3">
      <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
        <Radio className="size-4" />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        {m.content ? (
          <Markdown content={m.content} />
        ) : streaming ? (
          <span className="text-muted-foreground animate-pulse">▍</span>
        ) : null}
      </div>
    </div>
  )
}
