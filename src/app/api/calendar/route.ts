import { listEvents, upsertEvent, insertEvents, deleteEvent, type CalEvent } from "@/lib/db/calendar-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const events = await listEvents()
  return Response.json({ events })
}

export async function POST(req: Request) {
  const body = (await req.json()) as { event?: CalEvent; events?: CalEvent[] }
  if (Array.isArray(body.events)) {
    await insertEvents(body.events)
  } else if (body.event) {
    await upsertEvent(body.event)
  } else {
    return Response.json({ error: "event or events required" }, { status: 400 })
  }
  return Response.json({ ok: true })
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 })
  await deleteEvent(id)
  return Response.json({ ok: true })
}
