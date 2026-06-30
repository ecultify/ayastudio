import "server-only"
import { ANYA_PERSONA } from "@/lib/persona"
import { knowledgeDigest } from "@/lib/db/knowledge-store"
import { listWatchlist } from "@/lib/db/watchlist-store"
import { loadScanState } from "@/lib/db/scan-store"

/** The persona block shared by every Anya-voiced prompt across the app. */
export function personaBlock(): string {
  return (
    `You are ${ANYA_PERSONA.name} — ${ANYA_PERSONA.summary}\n` +
    `Audience: ${ANYA_PERSONA.audience}\n${ANYA_PERSONA.brief}\n` +
    `Brand voice & safety: ${ANYA_PERSONA.brandSafety}`
  )
}

export type GroundingOptions = {
  /** Include the knowledge-base digest (titles + summaries + source excerpts). */
  knowledge?: boolean
  /** Include the latest Pulse summary + do/don't guidance. */
  pulse?: boolean
  /** Include this week's top scored trends. */
  trends?: boolean
  /** Include the creator watchlist Anya benchmarks against. */
  watchlist?: boolean
  /** Char budget for the knowledge digest. */
  knowledgeChars?: number
}

/**
 * Assemble live grounding context shared across chat, the content engine and
 * the Pulse. Reads the persisted latest scan (does NOT trigger a new scan), the
 * knowledge base, and the watchlist, so every surface reasons from the same
 * picture of Anya's world.
 */
export async function groundingContext(opts: GroundingOptions = {}): Promise<string> {
  const { knowledge = true, pulse = true, trends = true, watchlist = true, knowledgeChars = 5000 } = opts
  const parts: string[] = []

  const [digest, scan, creators] = await Promise.all([
    knowledge ? knowledgeDigest({ maxChars: knowledgeChars }) : Promise.resolve(""),
    pulse || trends ? loadScanState() : Promise.resolve(null),
    watchlist ? listWatchlist() : Promise.resolve([]),
  ])

  if (knowledge && digest) {
    parts.push(
      `Anya's knowledge base shapes her personality, taste and brand. Treat it as authoritative for who she is and what she stands for:\n${digest}`,
    )
  }

  if (pulse && scan?.pulse) {
    const p = scan.pulse
    const dos = p.dos.length ? `\nDo this week: ${p.dos.join("; ")}` : ""
    const donts = p.donts.length ? `\nAvoid this week: ${p.donts.join("; ")}` : ""
    parts.push(`This week's Pulse — "${p.title}" (Mumbai relevance ${p.relevance}/100):\n${p.summary}${dos}${donts}`)
  }

  if (trends && scan?.trends?.length) {
    const lines = scan.trends
      .slice(0, 10)
      .map((t) => `- ${t.title} — ${t.type}, relevance ${t.relevance}/100, safety ${t.safety}`)
      .join("\n")
    parts.push(`This week's live signals:\n${lines}`)
  }

  if (watchlist && creators.length) {
    const lines = creators.map((c) => `- ${c.name} (${c.handle}) — ${c.note}`).join("\n")
    parts.push(`Creators Anya benchmarks against (for reference/positioning, not imitation):\n${lines}`)
  }

  return parts.join("\n\n")
}
