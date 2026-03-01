import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/middlewares/authGuard'
import { computeStats } from '@/server/services/statsService'

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const stats = await computeStats(auth.userId, auth.role)
    return NextResponse.json(stats, { status: 200 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
