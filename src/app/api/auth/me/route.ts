import { NextRequest, NextResponse } from 'next/server'
import { connectDb } from '@/server/db/mongoose'
import { UserModel } from '@/server/models/User'
import { requireAuth } from '@/server/middlewares/authGuard'

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)

    await connectDb()
    const user = await UserModel.findById(auth.userId).lean()
    if (!user) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 })

    return NextResponse.json(
      {
        id: String(user._id),
        email: user.email,
        role: user.role,
        isValidated: user.isValidated
      },
      { status: 200 }
    )
  } catch (e: any) {
    const msg = String(e?.message || 'UNAUTHORIZED')
    if (msg === 'UNAUTHORIZED') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
