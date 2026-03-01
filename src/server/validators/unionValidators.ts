import { z } from 'zod'

export const unionUpsertSchema = z.object({
  status: z.enum(['MARRIAGE', 'PACS', 'UNION', 'DIVORCED', 'SEPARATED', 'OTHER']).default('UNION'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),

  partnerIds: z.array(z.string().min(1)).max(2).default([]),

  children: z.array(
    z.object({
      childMemberId: z.string().min(1),
      linkType: z.enum(['BIOLOGICAL', 'ADOPTED', 'FOSTER']).default('BIOLOGICAL')
    })
  ).default([])
})
