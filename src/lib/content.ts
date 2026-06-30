import { openaiJSON } from "@/lib/openai"
import { ANYA_PERSONA, CONTENT_PILLARS } from "@/lib/persona"
import { peekScan } from "@/lib/scan/cache"
import { groundingContext } from "@/lib/context"

export type ContentIdea = {
  pillar: string
  format: "Reel" | "Carousel" | "Static"
  hook: string
  platform: string
  relevance: number
}

export type PlanPost = {
  title: string
  format: "Reel" | "Carousel" | "Static"
  pillar: string
  status: "Planned" | "Draft" | "Needs ref"
  /** Days from today to schedule this post. */
  dayOffset: number
}

const PILLAR_NAMES = CONTENT_PILLARS.map((p) => p.name)

async function topTrends(limit: number) {
  const scan = await peekScan()
  if (!scan) return []
  return scan.trends.slice(0, limit).map((t) => ({ title: t.title, type: t.type, relevance: t.relevance, platform: t.platform }))
}

/** Generate on-voice content ideas grounded in this week's live trends. */
export async function generateContentIdeas(opts: {
  platform: string
  pillar?: string
  brief?: string
  count?: number
}): Promise<ContentIdea[]> {
  const trends = await topTrends(15)
  const count = opts.count ?? 4
  const grounding = await groundingContext({ trends: false, knowledgeChars: 4000 })

  const out = await openaiJSON<{ ideas?: ContentIdea[] }>({
    system:
      `You are ${ANYA_PERSONA.name}'s content director. ${ANYA_PERSONA.summary}\n${ANYA_PERSONA.brief}\n` +
      `Brand safety: ${ANYA_PERSONA.brandSafety}\nRespond with strict JSON only.`,
    user:
      (grounding ? `${grounding}\n\n` : "") +
      `This week's live trends (JSON):\n${JSON.stringify(trends)}\n\n` +
      `Platform: ${opts.platform}\n` +
      (opts.pillar ? `Pillar focus: ${opts.pillar}\n` : `Pillars: ${PILLAR_NAMES.join(", ")}\n`) +
      (opts.brief ? `Brief: ${opts.brief}\n` : "") +
      `\nReturn JSON: { "ideas": [ { "pillar": <one of: ${PILLAR_NAMES.join(" | ")}>, ` +
      `"format": "Reel" | "Carousel" | "Static", "hook": <punchy on-voice hook/caption line, <=140 chars>, ` +
      `"platform": "${opts.platform}", "relevance": <0-100 fit score> } ] }\n` +
      `Give exactly ${count} ideas, ordered best-first.`,
    temperature: 0.7,
    maxTokens: 1200,
  })

  return (out.ideas ?? [])
    .filter((i) => i && i.hook)
    .slice(0, count)
    .map((i) => ({
      pillar: PILLAR_NAMES.includes(i.pillar) ? i.pillar : PILLAR_NAMES[0],
      format: (["Reel", "Carousel", "Static"] as const).includes(i.format) ? i.format : "Reel",
      hook: i.hook,
      platform: opts.platform,
      relevance: Math.min(100, Math.max(0, Math.round(Number(i.relevance) || 70))),
    }))
}

/** Generate an initial ~2-week content plan from live trends + pillars (for the calendar). */
export async function generateContentPlan(count = 10): Promise<PlanPost[]> {
  const trends = await topTrends(12)
  const grounding = await groundingContext({ trends: false, knowledgeChars: 3500 })

  const out = await openaiJSON<{ posts?: PlanPost[] }>({
    system:
      `You are ${ANYA_PERSONA.name}'s social media planner. ${ANYA_PERSONA.summary}\n${ANYA_PERSONA.brief}\n` +
      `Brand safety: ${ANYA_PERSONA.brandSafety}\nRespond with strict JSON only.`,
    user:
      (grounding ? `${grounding}\n\n` : "") +
      `This week's live trends (JSON):\n${JSON.stringify(trends)}\n\n` +
      `Plan ${count} posts across the next 14 days, spread out (not all on one day), mapped to the pillars: ${PILLAR_NAMES.join(", ")}.\n` +
      `Return JSON: { "posts": [ { "title": <short post title, <=60 chars>, "format": "Reel" | "Carousel" | "Static", ` +
      `"pillar": <one of the pillars>, "status": "Planned" | "Draft" | "Needs ref", "dayOffset": <integer 0-13 days from today> } ] }`,
    temperature: 0.7,
    maxTokens: 1500,
  })

  return (out.posts ?? [])
    .filter((p) => p && p.title)
    .slice(0, count)
    .map((p) => ({
      title: p.title,
      format: (["Reel", "Carousel", "Static"] as const).includes(p.format) ? p.format : "Reel",
      pillar: PILLAR_NAMES.includes(p.pillar) ? p.pillar : PILLAR_NAMES[0],
      status: (["Planned", "Draft", "Needs ref"] as const).includes(p.status) ? p.status : "Planned",
      dayOffset: Math.min(13, Math.max(0, Math.round(Number(p.dayOffset) || 0))),
    }))
}
