import bcrypt from 'bcrypt'
import { connectDb } from '@/server/db/mongoose'
import { UserModel, type UserRole } from '@/server/models/User'

export async function listUsers() {
  await connectDb()
  const users = await UserModel.find().sort({ createdAt: 1 }).lean()
  return users.map(u => ({
    id: String(u._id),
    email: u.email,
    role: u.role as UserRole,
    isValidated: Boolean(u.isValidated),
    createdAt: u.createdAt
  }))
}

export async function validateUser(userId: string) {
  await connectDb()
  const updated = await UserModel.findByIdAndUpdate(
    userId,
    { $set: { isValidated: true, role: 'USER' } },
    { new: true }
  ).lean()

  if (!updated) throw new Error('NOT_FOUND')

  return {
    id: String(updated._id),
    email: updated.email,
    role: updated.role,
    isValidated: updated.isValidated
  }
}

export async function setRole(userId: string, role: UserRole) {
  await connectDb()
  const updated = await UserModel.findByIdAndUpdate(
    userId,
    { $set: { role, isValidated: role === 'PENDING' ? false : true } },
    { new: true }
  ).lean()

  if (!updated) throw new Error('NOT_FOUND')

  return {
    id: String(updated._id),
    email: updated.email,
    role: updated.role,
    isValidated: updated.isValidated
  }
}

export async function deleteUser(userId: string) {
  await connectDb()
  const res = await UserModel.deleteOne({ _id: userId })
  if (res.deletedCount !== 1) throw new Error('NOT_FOUND')
  return { ok: true }
}

export async function createUserAsAdmin(email: string, password: string, role: UserRole) {
  await connectDb()
  const normalized = email.toLowerCase().trim()
  const passwordHash = await bcrypt.hash(password, 12)

  const isValidated = role !== 'PENDING'

  const created = await UserModel.create({
    email: normalized,
    passwordHash,
    role,
    isValidated
  })

  return {
    id: String(created._id),
    email: created.email,
    role: created.role,
    isValidated: created.isValidated
  }
}
