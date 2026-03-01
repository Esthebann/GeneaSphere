import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/middlewares/authGuard'
import { getRootGraph } from '@/server/services/graphService'

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const graph = await getRootGraph(auth.userId, auth.role)
    return NextResponse.json(graph, { status: 200 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: msg }, { status: 404 })
    if (msg === 'NO_PROFILE_MEMBER') return NextResponse.json({ error: msg }, { status: 400 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
