import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/middlewares/authGuard'
import { seedDemoForAdmin } from '@/server/services/seedDemoService'

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    if (auth.role !== 'ADMIN') return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })

    const out = await seedDemoForAdmin(auth.userId)
    return NextResponse.json(out, { status: 200 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
