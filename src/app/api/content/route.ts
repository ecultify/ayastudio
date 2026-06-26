import { generateContentIdeas } from "@/lib/content"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Generate on-voice content ideas from live trends + an optional brief. */
export async function POST(req: Request) {
  try {
    const { platform, pillar, brief } = (await req.json()) as {
      platform?: string
      pillar?: string
      brief?: string
    }
    const ideas = await generateContentIdeas({
      platform: platform || "Instagram",
      pillar: pillar || undefined,
      brief: brief || undefined,
    })
    return Response.json({ ideas })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
