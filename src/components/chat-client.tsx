"use client"

import { useEffect, useRef, useState } from "react"
import { Radio, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Markdown } from "@/components/markdown"

type Msg = { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "Plan next week's reels",
  "What's trending I should jump on?",
  "Give me three caption options for a match-night reel",
  "Rewrite this caption with more wit",
]

export function ChatClient() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages])

  // auto-grow the textarea
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px"
  }, [input])

  async function send(text: string) {
    const content = text.trim()
    if (!content || streaming) return

    const history = [...messages, { role: "user" as const, content }]
    setMessages([...history, { role: "assistant", content: "" }])
    setInput("")
    setStreaming(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
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
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2.5 border-b px-5">
        <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md">
          <Radio className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Ask Aya</div>
          <div className="text-muted-foreground text-[11px]">Grounded in this week&apos;s live signals</div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {empty ? (
            <div className="flex flex-col items-center gap-6 pt-[12vh] text-center">
              <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-xl">
                <Radio className="size-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Ask Aya</h2>
                <p className="text-muted-foreground mt-1 text-sm">Direction, copy and strategy from this week&apos;s signals.</p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="hover:bg-muted rounded-lg border px-4 py-3 text-left text-sm transition"
                  >
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
              placeholder="Ask about trends, copy, schedule…"
              className="placeholder:text-muted-foreground max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
            />
            <Button type="submit" size="icon" disabled={!input.trim() || streaming}>
              <Send className="size-4" />
            </Button>
          </form>
          <p className="text-muted-foreground mt-1.5 text-center text-[11px]">
            Enter to send · Shift+Enter for a new line
          </p>
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
  // Assistant: no bubble — avatar + clean rendered markdown.
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
