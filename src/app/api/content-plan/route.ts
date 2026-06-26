import { generateContentPlan } from "@/lib/content"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Generate a content plan from this week's live trends (for the calendar). */
export async function POST() {
  try {
    const posts = await generateContentPlan(10)
    return Response.json({ posts })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 })
  }
}
