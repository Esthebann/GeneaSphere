import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/middlewares/authGuard'
import { searchMembers } from '@/server/services/membersService'

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const q = req.nextUrl.searchParams.get('q') || ''
    const results = await searchMembers(q, auth.userId, auth.role)
    return NextResponse.json({ results }, { status: 200 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
