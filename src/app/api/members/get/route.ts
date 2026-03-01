import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/middlewares/authGuard'
import { memberIdSchema } from '@/server/validators/memberValidators'
import { canReadMember } from '@/server/lib/privacy'

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const body = await req.json()
    const parsed = memberIdSchema.parse(body)

    const res = await canReadMember(parsed.memberId, auth.userId, auth.role)
    if (!res.ok) {
      if (res.code === 'NOT_FOUND') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    return NextResponse.json(res.member, { status: 200 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
