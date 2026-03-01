import { z } from 'zod'

export const setRoleSchema = z.object({
  role: z.enum(['PENDING', 'USER', 'ADMIN'])
})

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['PENDING', 'USER', 'ADMIN']).default('USER')
})
