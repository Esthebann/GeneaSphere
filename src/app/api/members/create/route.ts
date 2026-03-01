import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/middlewares/authGuard'
import { memberCreateSchema } from '@/server/validators/memberValidators'
import { createMember } from '@/server/services/membersService'

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const body = await req.json()
    const parsed = memberCreateSchema.parse(body)

    const created = await createMember(parsed, auth.userId)
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
