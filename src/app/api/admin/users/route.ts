import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/middlewares/authGuard'
import { listUsers } from '@/server/services/adminUsersService'

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req)
    const users = await listUsers()
    return NextResponse.json({ users }, { status: 200 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
