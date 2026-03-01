import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/middlewares/authGuard'
import { memberUpdateSchema } from '@/server/validators/memberValidators'
import { canWriteMember } from '@/server/lib/privacy'
import { updateMember } from '@/server/services/membersService'

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const body = await req.json()
    const parsed = memberUpdateSchema.parse(body)

    const access = await canWriteMember(parsed.memberId, auth.userId, auth.role)
    if (!access.ok) {
      if (access.code === 'NOT_FOUND') return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const updated = await updateMember(parsed.memberId, parsed)
    if (!updated) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    return NextResponse.json(updated, { status: 200 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
