import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/middlewares/authGuard'
import { memberIdSchema } from '@/server/validators/memberValidators'
import { canWriteMember } from '@/server/lib/privacy'
import { deleteMember } from '@/server/services/membersService'

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const body = await req.json()
    const parsed = memberIdSchema.parse(body)

    const access = await canWriteMember(parsed.memberId, auth.userId, auth.role)
    if (!access.ok) {
      if (access.code === 'NOT_FOUND') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const ok = await deleteMember(parsed.memberId)
    if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
