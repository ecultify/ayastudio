import { env } from "@/lib/env"
import { AYA_PERSONA } from "@/lib/persona"
import { getScan } from "@/lib/scan/cache"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ChatMessage = { role: "user" | "assistant" | "system"; content: string }

/** Streaming chat with Aya, grounded in this week's live signals. */
export async function POST(req: Request) {
  const body = (await req.json()) as { messages?: ChatMessage[] }
  const messages = (body.messages ?? []).filter((m) => m.role !== "system").slice(-20)

  // Ground the assistant in the current scan (best-effort).
  let signalLines = "No scan available yet."
  try {
    const scan = await getScan()
    if (scan.trends.length) {
      signalLines = scan.trends
        .slice(0, 10)
        .map((t) => `- ${t.title} — ${t.type}, relevance ${t.relevance}/100, safety ${t.safety}`)
        .join("\n")
    }
  } catch {
    // ignore — chat still works without grounding
  }

  const system =
    `You are ${AYA_PERSONA.name} — ${AYA_PERSONA.summary}\n` +
    `Audience: ${AYA_PERSONA.audience}\n${AYA_PERSONA.brief}\n\n` +
    `Brand voice & safety: ${AYA_PERSONA.brandSafety}\n\n` +
    `This week's live signals:\n${signalLines}\n\n` +
    `You help Aya's team with content direction, copy, and weekly planning. ` +
    `Be sharp, practical, and on-brand. Keep answers concise; use short lists when giving options.\n\n` +
    `Formatting: reply in Markdown. Whenever you produce something meant to be copied and used as-is — ` +
    `a caption, an email, a DM, a script, a shot list, or code — put ONLY that content inside a fenced code block ` +
    "(```), using ```text for captions/emails/scripts. " +
    `Keep your conversational explanation OUTSIDE the fences. If you give multiple captions to choose from, ` +
    `put each in its own fenced block so each can be copied separately.`

  let upstream: Response
  try {
    upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.openaiKey()}` },
      body: JSON.stringify({
        model: env.openaiModel(),
        stream: true,
        temperature: 0.6,
        messages: [{ role: "system", content: system }, ...messages],
      }),
    })
  } catch (e) {
    return new Response(`Upstream error: ${(e as Error).message}`, { status: 502 })
  }

  if (!upstream.ok || !upstream.body) {
    return new Response(`OpenAI ${upstream.status}: ${await upstream.text()}`, { status: 502 })
  }

  // Re-stream OpenAI's SSE as a plain UTF-8 token stream.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader()
      const decoder = new TextDecoder()
      const encoder = new TextEncoder()
      let buffer = ""
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith("data:")) continue
            const data = trimmed.slice(5).trim()
            if (data === "[DONE]") {
              controller.close()
              return
            }
            try {
              const json = JSON.parse(data)
              const delta = json.choices?.[0]?.delta?.content
              if (delta) controller.enqueue(encoder.encode(delta))
            } catch {
              // skip keep-alive / partial frames
            }
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}
