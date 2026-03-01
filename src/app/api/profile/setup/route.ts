import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/server/middlewares/authGuard'
import { profileSetupSchema } from '@/server/validators/memberValidators'
import { setupProfileMember } from '@/server/services/profileService'

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const body = await req.json()
    const parsed = profileSetupSchema.parse(body)

    const res = await setupProfileMember(auth.userId, parsed)
    return NextResponse.json(res, { status: 200 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: msg }, { status: 404 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
