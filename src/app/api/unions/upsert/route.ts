import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/middlewares/authGuard'
import { unionUpsertSchema } from '@/server/validators/unionValidators'
import { upsertUnion } from '@/server/services/unionsService'

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const body = await req.json()
    const parsed = unionUpsertSchema.parse(body)

    const created = await upsertUnion(parsed, auth.userId)
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === 'CHILD_CANNOT_BE_PARTNER') return NextResponse.json({ error: msg }, { status: 400 })
    if (msg === 'CYCLE_DETECTED') return NextResponse.json({ error: msg }, { status: 400 })
    if (msg === 'INVALID_UNION_DATES') return NextResponse.json({ error: msg }, { status: 400 })
    if (msg === 'TOO_MANY_PARTNERS') return NextResponse.json({ error: msg }, { status: 400 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
