import { getMessages, renameSession, deleteSession } from "@/lib/db/chat-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const messages = await getMessages(id)
  return Response.json({ messages })
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  const body = (await req.json()) as { title?: string }
  if (body.title) await renameSession(id, body.title)
  return Response.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  await deleteSession(id)
  return Response.json({ ok: true })
}
