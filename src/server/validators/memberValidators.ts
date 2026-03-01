import { z } from 'zod'

export const memberCreateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  sex: z.enum(['M', 'F', 'X']),
  photoUrl: z.string().url().optional(),
  birthDate: z.string().datetime().optional(),
  deathDate: z.string().datetime().optional(),
  professions: z.array(z.string()).optional(),
  contacts: z.object({
    addresses: z.array(z.string()).optional(),
    phones: z.array(z.string()).optional(),
    emails: z.array(z.string()).optional()
  }).optional(),
  notes: z.string().optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional()
})

export const memberUpdateSchema = memberCreateSchema.partial().extend({
  memberId: z.string().min(1)
})

export const memberIdSchema = z.object({
  memberId: z.string().min(1)
})

export const profileSetupSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  sex: z.enum(['M', 'F', 'X'])
})
