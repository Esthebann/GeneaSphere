import jwt, { type Secret, type SignOptions } from 'jsonwebtoken'

export type JwtPayload = {
  sub: string
  role: 'PENDING' | 'USER' | 'ADMIN'
}

export function signJwt(payload: JwtPayload) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET missing')

  const expiresInEnv = process.env.JWT_EXPIRES_IN || '24h'

  const options: SignOptions = { expiresIn: expiresInEnv as any }

  return jwt.sign(payload as any, secret as Secret, options)
}

export function verifyJwt(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET missing')

  return jwt.verify(token, secret as Secret) as JwtPayload
}
