import { z } from 'zod/v4'

export const id = z.string().trim().min(1).max(128)
export const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
export const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}, 'Data civil inválida')

export const apiSuccessSchema = z.object({
  data: z.unknown(),
  requestId: z.string(),
  serverTime: z.string().datetime({ offset: true }),
})

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
})
