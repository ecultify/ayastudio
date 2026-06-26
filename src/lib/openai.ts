import { env } from "@/lib/env"

/** Minimal OpenAI Chat Completions helper that returns parsed JSON. */
export async function openaiJSON<T>(opts: {
  system: string
  user: string
  model?: string
  maxTokens?: number
  temperature?: number
}): Promise<T> {
  const body = JSON.stringify({
    model: opts.model ?? env.openaiModel(),
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_object" },
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 2000,
  })

  // Retry transient upstream failures (e.g. Cloudflare 520/429/503 in front of OpenAI).
  const MAX_ATTEMPTS = 3
  let lastErr = ""
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.openaiKey()}` },
      body,
      cache: "no-store",
    })

    if (res.ok) {
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error("OpenAI: empty response")
      return JSON.parse(content) as T
    }

    lastErr = `OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`
    const retriable = res.status === 429 || res.status >= 500
    if (!retriable || attempt === MAX_ATTEMPTS) break
    await new Promise((r) => setTimeout(r, 600 * attempt))
  }
  throw new Error(lastErr)
}
