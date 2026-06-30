import { env } from "@/lib/env"
import { personaBlock, groundingContext } from "@/lib/context"
import { addMessage, renameSession } from "@/lib/db/chat-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ChatMessage = { role: "user" | "assistant" | "system"; content: string }

// A search-capable model lets Anya research independently (live web), beyond the
// knowledge base + report. Falls back to the standard model if it's unavailable.
const SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL ?? "gpt-4o-mini-search-preview"

async function openOpenAIStream(body: object): Promise<Response> {
  return fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.openaiKey()}` },
    body: JSON.stringify(body),
  })
}

/** Streaming chat with Anya — grounded in her knowledge base + this week's Pulse, able to research the live web. */
export async function POST(req: Request) {
  const body = (await req.json()) as { messages?: ChatMessage[]; sessionId?: string }
  const messages = (body.messages ?? []).filter((m) => m.role !== "system").slice(-20)
  const sessionId = body.sessionId

  // Persist the new user turn + set the session title on the first message.
  const lastUser = [...messages].reverse().find((m) => m.role === "user")
  if (sessionId && lastUser) {
    await addMessage(sessionId, "user", lastUser.content)
    if (messages.filter((m) => m.role === "user").length === 1) {
      await renameSession(sessionId, lastUser.content.slice(0, 60))
    }
  }

  // Grounding: knowledge base + Pulse + trends + watchlist shape WHO Anya is and
  // what she knows; she may also research the live web for anything beyond it.
  let grounding = ""
  try {
    grounding = await groundingContext({ knowledge: true, pulse: true, trends: true, watchlist: true, knowledgeChars: 6000 })
  } catch {
    /* chat still works without grounding */
  }

  const system =
    `${personaBlock()}\n\n` +
    (grounding ? `${grounding}\n\n` : "") +
    `Anya's knowledge base and Pulse reports above shape her personality, taste and brand — treat them as ` +
    `authoritative for who she is. Beyond them, you can and should research the live web for current facts, ` +
    `news, releases, events and anything you're unsure about, then answer in Anya's voice.\n\n` +
    `You help Anya's team with content direction, copy, research and weekly planning. Be sharp, practical and ` +
    `on-brand. Keep answers concise; use short lists when giving options.\n\n` +
    `Formatting: reply in Markdown. Whenever you produce something meant to be copied and used as-is — ` +
    `a caption, an email, a DM, a script, a shot list, or code — put ONLY that content inside a fenced code block ` +
    "(```), using ```text for captions/emails/scripts. " +
    `Keep your conversational explanation OUTSIDE the fences. If you give multiple captions to choose from, ` +
    `put each in its own fenced block so each can be copied separately.`

  const convo = [{ role: "system" as const, content: system }, ...messages]

  // Try the search-capable model first; fall back to the standard chat model.
  let upstream: Response
  try {
    upstream = await openOpenAIStream({ model: SEARCH_MODEL, stream: true, web_search_options: {}, messages: convo })
    if (!upstream.ok) {
      upstream = await openOpenAIStream({ model: env.openaiModel(), stream: true, temperature: 0.6, messages: convo })
    }
  } catch (e) {
    return new Response(`Upstream error: ${(e as Error).message}`, { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(`OpenAI ${upstream.status}: ${await upstream.text()}`, { status: 502 })
  }

  // Re-stream OpenAI's SSE as a plain UTF-8 token stream, accumulating the full
  // reply so we can persist it when the stream closes.
  let full = ""
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader()
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      let buffer = ""
      let done = false
      try {
        while (!done) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith("data:")) continue
            const data = trimmed.slice(5).trim()
            if (data === "[DONE]") {
              done = true
              break
            }
            try {
              const json = JSON.parse(data)
              const delta = json.choices?.[0]?.delta?.content
              if (delta) {
                full += delta
                controller.enqueue(encoder.encode(delta))
              }
            } catch {
              /* skip keep-alive / partial frames */
            }
          }
        }
      } finally {
        controller.close()
        if (sessionId && full) await addMessage(sessionId, "assistant", full)
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}
