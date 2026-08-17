import { z } from 'zod'
import { McpHttpError } from '@/lib/mcp/errors'

export const idSchema = z.string().trim().min(1).max(128)
export const emailSchema = z.string().trim().toLowerCase().email().max(254)
export const currencySchema = z.string().regex(/^[A-Z]{3}$/)
export const localeSchema = z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/)
export const positiveCentsSchema = z.number().int().positive().max(2_147_483_647)
export const nonNegativeCentsSchema = z.number().int().min(0).max(2_147_483_647)
export const civilDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
})
export const isoInstantSchema = z.string().datetime({ offset: true })
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

export const walletIdSchema = z.object({ walletId: idSchema })
export const expenseIdSchema = z.object({ walletId: idSchema, expenseId: idSchema })
export const categoryIdSchema = z.object({ walletId: idSchema, categoryId: idSchema })
export const memberIdSchema = z.object({ walletId: idSchema, memberId: idSchema })
export const inviteIdSchema = z.object({ inviteId: idSchema })

export const listExpensesSchema = z.object({
  walletId: idSchema,
  month: monthSchema,
  status: z.enum(['pending', 'paid', 'overdue']).optional(),
  categoryId: idSchema.optional(),
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const monthSummarySchema = z.object({
  walletId: idSchema,
  month: monthSchema,
})

export function parseQuery<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new McpHttpError(400, 'VALIDATION_ERROR', 'Parâmetros inválidos')
  return result.data
}
