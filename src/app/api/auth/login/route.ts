import { NextResponse } from 'next/server'
import { loginSchema } from '@/server/validators/authValidators'
import { loginUser } from '@/server/services/authService'

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const data = loginSchema.parse(json)

    const result = await loginUser(data.email, data.password)
    return NextResponse.json(result, { status: 200 })
  } catch (e: any) {
    const msg = String(e?.message || 'BAD_REQUEST')

    if (msg === 'INVALID_CREDENTIALS') return NextResponse.json({ error: msg }, { status: 401 })
    if (msg === 'NOT_VALIDATED') return NextResponse.json({ error: msg }, { status: 403 })

    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
