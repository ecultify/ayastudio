import { env } from "@/lib/env"
import { ANYA_PERSONA } from "@/lib/persona"
import { openaiJSON } from "@/lib/openai"

export type Usefulness = "High" | "Medium" | "Low"

export type FileAnalysis = {
  /** Human-friendly name for the file (replaces an opaque/auto-generated filename). */
  title: string
  /** Short label capturing what the file is for. */
  tag: string
  category: string
  usefulness: Usefulness
  score: number
  summary: string
  reason: string
}

export type FileAnalysisResult = FileAnalysis & {
  /** False when the model can't confidently tell what the file is / how it helps Anya. */
  confident: boolean
  /** A clarifying question to ask the uploader when not confident. */
  question: string
}

export const KB_CATEGORIES = [
  "Reference / Moodboard",
  "Brand & Voice",
  "Music & Sound",
  "Trend Research",
  "Brief / Strategy",
  "Audience / Analytics",
  "Legal / Admin",
  "Other",
]

const CATEGORY_GUIDE = [
  "Reference / Moodboard — photos, screenshots, moodboards, any visual/style/aesthetic reference",
  "Brand & Voice — brand guidelines, tone-of-voice, persona, visual identity, asset bibles",
  "Music & Sound — tracks, playlists, audio, sound or music references",
  "Trend Research — trend reports, competitor/creator analysis, cultural research",
  "Brief / Strategy — campaign briefs, content strategy, plans, playbooks",
  "Audience / Analytics — metrics, audience data, performance reports",
  "Legal / Admin — contracts, invoices, schedules, admin docs",
  "Other — only if it genuinely fits none of the above",
].join("\n")

/** Categorize an uploaded file and rate how useful it is for Anya (vision-aware for images). */
export async function analyzeFile(input: {
  name: string
  mime: string
  size: number
  text?: string
  imageDataUrl?: string
  /** User-supplied description of what the file is for; treated as authoritative. */
  note?: string
  /** Earlier AI summary, supplied when re-tagging so the model can refine it. */
  priorSummary?: string
  /** Earlier category, supplied when re-tagging. */
  priorCategory?: string
}): Promise<FileAnalysisResult> {
  const system =
    `You are the librarian for ${ANYA_PERSONA.name} — ${ANYA_PERSONA.summary}\n${ANYA_PERSONA.brief}\n` +
    `You triage uploaded files for the team's knowledge base. Respond with strict JSON only.`

  const instruction =
    `File: name="${input.name}", type="${input.mime || "unknown"}", size=${input.size} bytes.\n` +
    (input.text ? `\nExtracted text (may be truncated):\n"""\n${input.text}\n"""\n` : "") +
    (input.imageDataUrl ? `\n(The image is attached — judge it from what you actually see.)\n` : "") +
    (input.note ? `\nThe uploader describes what this file is for: "${input.note}". Treat this as authoritative — correct the title, summary and category to match it.\n` : "") +
    (input.priorSummary ? `\nYour earlier read of this file: "${input.priorSummary}"${input.priorCategory ? ` (categorised as ${input.priorCategory})` : ""}. Refine it in light of the uploader's description above.\n` : "") +
    `\nCATEGORIES (pick the single best fit):\n${CATEGORY_GUIDE}\n` +
    `\nSCORING — how useful is THIS file for Anya's content work? Use the FULL 0–100 range and be discriminating; ` +
    `do NOT default to a round number like 85:\n` +
    `- 80–100 (High): directly shapes Anya's content — strong on-aesthetic references, brand/voice docs, sharp briefs.\n` +
    `- 45–79 (Medium): relevant but supporting — partial fit, background, or needs work to use.\n` +
    `- 0–44 (Low): off-brand, generic, admin, or low signal for Anya.\n` +
    `\nCONFIDENCE: set "confident" false when you can't actually tell what this file/image is or how it serves Anya ` +
    `— e.g. an ambiguous, generic, or random image, or a vague document. When false, write a short "question" asking ` +
    `the uploader what it is and how Anya should use it. When you clearly understand it, set confident true and question "".\n` +
    `\nReturn JSON: { "reason": <one sentence on why it is or isn't useful for Anya, drives the score, <=140 chars>, ` +
    `"title": <a short human-friendly name for this file in Title Case, no file extension, <=60 chars>, ` +
    `"tag": <a 1-3 word Title Case label capturing what this file is for, <=24 chars>, ` +
    `"category": <exactly one category name from the list>, ` +
    `"usefulness": "High" | "Medium" | "Low", "score": <integer 0-100, consistent with usefulness band and reason>, ` +
    `"summary": <one sentence on what this file actually is, <=140 chars>, ` +
    `"confident": <boolean>, "question": <clarifying question if not confident, else ""> }`

  const userContent = input.imageDataUrl
    ? [
        { type: "text", text: instruction },
        { type: "image_url", image_url: { url: input.imageDataUrl } },
      ]
    : instruction

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.openaiKey()}` },
    body: JSON.stringify({
      model: env.openaiModel(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 400,
    }),
    cache: "no-store",
  })

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error("OpenAI: empty response")

  const parsed = JSON.parse(content) as Partial<FileAnalysisResult>
  const usefulness: Usefulness =
    parsed.usefulness === "High" || parsed.usefulness === "Low" ? parsed.usefulness : "Medium"

  return {
    title: String(parsed.title ?? "").slice(0, 60),
    tag: String(parsed.tag ?? "").slice(0, 24),
    category: KB_CATEGORIES.includes(parsed.category ?? "") ? (parsed.category as string) : "Other",
    usefulness,
    score: Math.min(100, Math.max(0, Math.round(Number(parsed.score) || 50))),
    summary: String(parsed.summary ?? "").slice(0, 200),
    reason: String(parsed.reason ?? "").slice(0, 200),
    // default to confident unless the model explicitly flags uncertainty
    confident: parsed.confident !== false,
    question: String(parsed.question ?? "").slice(0, 200),
  }
}

export type ProposedNote = { title: string; body: string }
export type NoteSplit = { folderName: string; folderDescription: string; notes: ProposedNote[] }

// Only split documents long enough to have multiple distinct sections worth
// breaking out. Short files stay as a single knowledge item.
export const SPLIT_MIN_CHARS = 2500

/**
 * Read a long document and break it into a small set of focused markdown notes
 * the rest of the app can reason over individually. The AI decides how many
 * notes (2–6) and what each covers; they're filed into one folder.
 */
export async function proposeNotes(input: { title: string; text: string }): Promise<NoteSplit | null> {
  const text = input.text.slice(0, 14000)
  if (text.trim().length < SPLIT_MIN_CHARS) return null

  const out = await openaiJSON<{
    folderName?: string
    folderDescription?: string
    notes?: { title?: string; body?: string }[]
  }>({
    system:
      `You are the librarian for ${ANYA_PERSONA.name} — ${ANYA_PERSONA.summary}\n` +
      `You organise a long source document into a folder of focused markdown notes that ` +
      `${ANYA_PERSONA.shortName}'s other tools (chat, content engine, Pulse) can each read on their own. ` +
      `Respond with strict JSON only.`,
    user:
      `Source document title: "${input.title}"\n\n` +
      `Document text (may be truncated):\n"""\n${text}\n"""\n\n` +
      `Break this into 2–6 self-contained notes, each covering ONE distinct theme (e.g. brand voice, ` +
      `visual direction, content pillars, compliance, audience, campaign plan). Each note's body must be ` +
      `clean, useful Markdown that extracts and organises the real content for that theme (not a vague summary). ` +
      `Return JSON: { "folderName": <short Title Case name for the folder, <=50 chars>, ` +
      `"folderDescription": <one sentence on what this folder holds, <=140 chars>, ` +
      `"notes": [ { "title": <short Title Case note title, <=60 chars>, "body": <Markdown body, 80–500 words> } ] }`,
    temperature: 0.4,
    maxTokens: 3500,
  })

  const notes = (out.notes ?? [])
    .filter((n) => n && n.title && n.body)
    .slice(0, 6)
    .map((n) => ({ title: String(n.title).slice(0, 60), body: String(n.body).slice(0, 8000) }))

  if (notes.length === 0) return null
  return {
    folderName: String(out.folderName || input.title).slice(0, 50),
    folderDescription: String(out.folderDescription || "").slice(0, 140),
    notes,
  }
}
