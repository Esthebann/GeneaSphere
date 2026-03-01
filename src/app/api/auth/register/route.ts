import { NextResponse } from 'next/server'
import { registerSchema } from '@/server/validators/authValidators'
import { registerUser } from '@/server/services/authService'

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const data = registerSchema.parse(json)

    const created = await registerUser(data.email, data.password)

    return NextResponse.json(created, { status: 201 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')

    if (msg.includes('E11000')) {
      return NextResponse.json({ error: 'EMAIL_ALREADY_EXISTS' }, { status: 409 })
    }

    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
