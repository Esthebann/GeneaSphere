import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/middlewares/authGuard'
import { setRoleSchema } from '@/server/validators/adminValidators'
import { setRole } from '@/server/services/adminUsersService'

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req)
    const body = await req.json()
    const userId = String(body?.userId || '').trim()
    if (!userId) return NextResponse.json({ error: 'MISSING_USER_ID' }, { status: 400 })

    const parsed = setRoleSchema.parse({ role: body?.role })
    const updated = await setRole(userId, parsed.role)

    return NextResponse.json(updated, { status: 200 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: msg }, { status: 403 })
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: msg }, { status: 404 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
