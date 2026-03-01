import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/middlewares/authGuard'
import { createUserSchema } from '@/server/validators/adminValidators'
import { createUserAsAdmin } from '@/server/services/adminUsersService'

export async function POST(req: NextRequest) {
  try {
    requireAdmin(req)
    const body = await req.json()
    const parsed = createUserSchema.parse(body)

    const created = await createUserAsAdmin(parsed.email, parsed.password, parsed.role)
    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')

    if (msg.includes('E11000')) {
      return NextResponse.json({ error: 'EMAIL_ALREADY_EXISTS' }, { status: 409 })
    }

    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
