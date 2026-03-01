import { NextRequest } from 'next/server'
import { verifyJwt } from '@/server/lib/jwt'

export type AuthUser = { userId: string; role: 'PENDING' | 'USER' | 'ADMIN' }

export function getAuthUser(req: NextRequest): AuthUser | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  if (!header.startsWith('Bearer ')) return null

  const token = header.slice('Bearer '.length).trim()
  if (!token) return null

  try {
    const payload = verifyJwt(token)
    return { userId: payload.sub, role: payload.role }
  } catch {
    return null
  }
}

export function requireAuth(req: NextRequest): AuthUser {
  const user = getAuthUser(req)
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

export function requireAdmin(req: NextRequest): AuthUser {
  const user = requireAuth(req)
  if (user.role !== 'ADMIN') {
    throw new Error('FORBIDDEN')
  }
  return user
}
