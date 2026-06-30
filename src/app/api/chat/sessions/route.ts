import { listSessions, createSession } from "@/lib/db/chat-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const sessions = await listSessions()
  return Response.json({ sessions })
}

export async function POST() {
  const session = await createSession()
  if (!session) return Response.json({ error: "Database unavailable" }, { status: 503 })
  return Response.json({ session })
}
