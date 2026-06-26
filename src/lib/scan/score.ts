import { openaiJSON } from "@/lib/openai"
import { AYA_PERSONA } from "@/lib/persona"
import type { Candidate, Fixture, ScoredTrend, Pulse, TrendType, Safety } from "./types"

const TREND_TYPES: TrendType[] = ["Music", "Visual", "Caption"]
const SAFETIES: Safety[] = ["Clear", "Review", "Avoid"]

function clampScore(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return 50
  return Math.min(100, Math.max(0, v))
}

type ScoreItem = { i: number; title?: string; type?: string; relevance?: number; safety?: string; note?: string }

/**
 * Score every discovery candidate for fit with Aya's brand in a single LLM call.
 * Returns scored trends (unranked); the orchestrator sorts + ranks them.
 */
export async function scoreCandidates(candidates: Candidate[]): Promise<ScoredTrend[]> {
  if (candidates.length === 0) return []

  const list = candidates.map((c, i) => ({
    i,
    source: c.source,
    title: c.title,
    subtitle: c.subtitle,
    metric: c.metric,
  }))

  const system =
    `You are a cultural trend analyst for ${AYA_PERSONA.name}, ${AYA_PERSONA.summary}\n` +
    `Audience: ${AYA_PERSONA.audience}\n${AYA_PERSONA.brief}\n\n` +
    `Brand voice & safety: ${AYA_PERSONA.brandSafety}\n\n` +
    `Score how well each candidate fits Aya's Mumbai-first music/culture content. Respond with strict JSON only.`

  const user =
    `Candidates (JSON array):\n${JSON.stringify(list)}\n\n` +
    `Return JSON of the exact form:\n` +
    `{ "items": [ { "i": <candidate index>, "title": <concise cleaned title, <=70 chars>, ` +
    `"type": "Music" | "Visual" | "Caption", "relevance": <integer 0-100 fit for Aya>, ` +
    `"safety": "Clear" | "Review" | "Avoid", "note": <why it matters for Aya, <=120 chars> } ] }\n` +
    `Include every candidate exactly once.`

  const out = await openaiJSON<{ items?: ScoreItem[] }>({ system, user, maxTokens: 3500 })

  return (out.items ?? [])
    .filter((it) => candidates[it.i])
    .map((it) => {
      const c = candidates[it.i]
      const type = TREND_TYPES.includes(it.type as TrendType) ? (it.type as TrendType) : "Music"
      const safety = SAFETIES.includes(it.safety as Safety) ? (it.safety as Safety) : "Review"
      return {
        title: it.title?.trim() || c.title,
        platform: c.platform,
        type,
        relevance: clampScore(it.relevance),
        safety,
        volume: c.metric ?? "—",
        note: it.note?.trim() ?? "",
        url: c.url,
      }
    })
}

/**
 * Build the weekly Pulse. Counts/flags/relevance are derived deterministically
 * from the scored trends; only the narrative summary comes from the LLM.
 */
export async function generatePulse(
  trends: ScoredTrend[],
  now: Date,
  fixtures: Fixture[] = [],
): Promise<Pulse> {
  const clear = trends.filter((t) => t.safety === "Clear")
  const music = clear.filter((t) => t.type === "Music").length
  const visual = clear.filter((t) => t.type === "Visual").length
  const caption = clear.filter((t) => t.type === "Caption").length
  const flags = trends.filter((t) => t.safety !== "Clear").length
  const relevance =
    trends.length > 0 ? Math.round(trends.reduce((s, t) => s + t.relevance, 0) / trends.length) : 0

  const dateLabel = now.toLocaleDateString("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const week = isoWeek(now)

  let summary = "Live culture scan ready — review the top signals below."
  let dos: string[] = []
  let donts: string[] = []
  try {
    const top = trends.slice(0, 12).map((t) => ({
      title: t.title,
      type: t.type,
      relevance: t.relevance,
      safety: t.safety,
    }))
    const matchNights = fixtures.slice(0, 6).map((f) => ({
      matchup: f.matchup,
      tournament: f.tournament,
      when: f.startsAt,
      india: f.india,
    }))
    const out = await openaiJSON<{ summary?: string; dos?: string[]; donts?: string[] }>({
      system:
        `You are ${AYA_PERSONA.name}'s weekly "Pulse" strategist. ${AYA_PERSONA.summary}\n` +
        `Brand safety: ${AYA_PERSONA.brandSafety}\n` +
        `Write a sharp, brand-voiced brief. Respond with strict JSON only.`,
      user:
        `This week's top scored trends (JSON):\n${JSON.stringify(top)}\n\n` +
        `Upcoming cricket match-nights (JSON; use for culture-first match-night moments only — ` +
        `never betting/odds/wagering): ${JSON.stringify(matchNights)}\n\n` +
        `Return JSON: { "summary": <2-3 sentence brief on what to make this week and why, brand-voiced, <=320 chars>, ` +
        `"dos": [<3 specific, actionable moves for this week, each <=110 chars>], ` +
        `"donts": [<3 specific things to avoid this week given the signals + brand safety, each <=110 chars>] }`,
      maxTokens: 700,
    })
    if (out.summary?.trim()) summary = out.summary.trim()
    if (Array.isArray(out.dos)) dos = out.dos.filter((x) => typeof x === "string").slice(0, 3)
    if (Array.isArray(out.donts)) donts = out.donts.filter((x) => typeof x === "string").slice(0, 3)
  } catch {
    // Non-fatal: keep fallbacks if the narrative call fails.
  }

  return {
    id: `r-${now.toISOString().slice(0, 10)}`,
    title: `Aya Pulse — Week ${week}`,
    date: dateLabel,
    status: "Ready",
    relevance,
    music,
    visual,
    caption,
    flags,
    summary,
    dos,
    donts,
  }
}

function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
