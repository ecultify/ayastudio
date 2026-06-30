import { listWatchlist, addCreator, removeCreator } from "@/lib/db/watchlist-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const creators = await listWatchlist()
  return Response.json({ creators })
}

export async function POST(req: Request) {
  const body = (await req.json()) as { handle?: string; name?: string; note?: string; followers?: string }
  if (!body.handle || !body.name) return Response.json({ error: "handle and name required" }, { status: 400 })
  const creator = await addCreator({
    handle: body.handle,
    name: body.name,
    note: body.note,
    followers: body.followers,
  })
  if (!creator) return Response.json({ error: "Database unavailable" }, { status: 503 })
  return Response.json({ creator })
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id")
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 })
  await removeCreator(id)
  return Response.json({ ok: true })
}
