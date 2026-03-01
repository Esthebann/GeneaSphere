import bcrypt from 'bcrypt'
import { connectDb } from '@/server/db/mongoose'
import { UserModel } from '@/server/models/User'
import { signJwt } from '@/server/lib/jwt'

export async function registerUser(email: string, password: string) {
  await connectDb()

  const normalized = email.toLowerCase().trim()

  const adminsCount = await UserModel.countDocuments({ role: 'ADMIN' })
  const isBootstrapAdmin = adminsCount === 0

  const passwordHash = await bcrypt.hash(password, 12)

  const role = isBootstrapAdmin ? 'ADMIN' : 'PENDING'
  const isValidated = isBootstrapAdmin

  const created = await UserModel.create({
    email: normalized,
    passwordHash,
    role,
    isValidated
  })

  return {
    id: created._id.toString(),
    email: created.email,
    role: created.role,
    isValidated: created.isValidated
  }
}

export async function loginUser(email: string, password: string) {
  await connectDb()

  const normalized = email.toLowerCase().trim()
  const user = await UserModel.findOne({ email: normalized })
  if (!user) {
    throw new Error('INVALID_CREDENTIALS')
  }

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) {
    throw new Error('INVALID_CREDENTIALS')
  }

  if (!user.isValidated || user.role === 'PENDING') {
    throw new Error('NOT_VALIDATED')
  }

  const token = signJwt({ sub: user._id.toString(), role: user.role })
  return { token }
}
