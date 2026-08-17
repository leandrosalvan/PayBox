import { z } from 'zod'
import {
  civilDateSchema,
  currencySchema,
  emailSchema,
  idSchema,
  isoInstantSchema,
  localeSchema,
  monthSchema,
  nonNegativeCentsSchema,
  positiveCentsSchema,
} from '@/lib/mcp/schemas'

export const createWalletSchema = z.object({
  name: z.string().trim().min(1).max(100),
  locale: localeSchema.default('pt-BR'),
  currency: currencySchema.default('BRL'),
  salaryMode: z.enum(['joint', 'individual']).default('joint'),
})

export const updateWalletSchema = z.object({
  walletId: idSchema,
  changes: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    locale: localeSchema.optional(),
    currency: currencySchema.optional(),
    salaryMode: z.enum(['joint', 'individual']).optional(),
  }).refine((value) => Object.keys(value).length > 0),
  expectedUpdatedAt: isoInstantSchema,
})

export const createCategorySchema = z.object({
  walletId: idSchema,
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#10b981'),
  icon: z.string().trim().min(1).max(50).default('tag'),
})

export const updateCategorySchema = z.object({
  walletId: idSchema,
  categoryId: idSchema,
  changes: z.object({
    name: z.string().trim().min(1).max(80).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    icon: z.string().trim().min(1).max(50).optional(),
  }).refine((value) => Object.keys(value).length > 0),
})

export const expenseInputSchema = z.object({
  description: z.string().trim().min(1).max(200),
  amountInCents: positiveCentsSchema,
  currency: currencySchema,
  dueDate: civilDateSchema,
  categoryId: idSchema.nullable().optional(),
  type: z.enum(['single', 'fixed', 'installment']).default('single'),
  totalInstallments: z.number().int().min(2).max(120).optional(),
  paidById: idSchema.nullable().optional(),
}).superRefine((value, context) => {
  if (value.type === 'installment' && !value.totalInstallments) {
    context.addIssue({ code: 'custom', path: ['totalInstallments'], message: 'Parcelas obrigatórias' })
  }
})

export const createExpenseSchema = z.object({ walletId: idSchema, input: expenseInputSchema })

export const updateExpenseSchema = z.object({
  walletId: idSchema,
  expenseId: idSchema,
  changes: z.object({
    description: z.string().trim().min(1).max(200).optional(),
    amountInCents: positiveCentsSchema.optional(),
    dueDate: civilDateSchema.optional(),
    categoryId: idSchema.nullable().optional(),
    paidById: idSchema.nullable().optional(),
  }).refine((value) => Object.keys(value).length > 0),
  expectedUpdatedAt: isoInstantSchema,
})

export const setExpensePaymentSchema = z.object({
  walletId: idSchema,
  expenseId: idSchema,
  status: z.enum(['paid', 'pending']),
  paidById: idSchema.optional(),
  paidAt: isoInstantSchema.optional(),
  expectedUpdatedAt: isoInstantSchema,
})

export const updateMemberSalarySchema = z.object({
  walletId: idSchema,
  memberId: idSchema,
  salaryInCents: nonNegativeCentsSchema,
})

export const createInviteSchema = z.object({
  walletId: idSchema,
  email: emailSchema,
  sendEmail: z.boolean().default(false),
})

export const acceptInviteSchema = z.object({ inviteId: idSchema })

export const duplicateExpenseSchema = z.object({
  walletId: idSchema,
  expenseId: idSchema,
  startMonth: monthSchema,
})

export const convertInstallmentsSchema = z.object({
  walletId: idSchema,
  expenseId: idSchema,
  installments: z.number().int().min(2).max(120),
})

export const destructiveActionSchema = z.enum([
  'delete_expense',
  'stop_recurring_expense',
  'delete_future_expenses',
  'delete_expense_series',
  'delete_category',
  'remove_wallet_member',
  'delete_wallet',
])

export const destructiveTargetSchema = z.object({
  walletId: idSchema,
  expenseId: idSchema.optional(),
  categoryId: idSchema.optional(),
  memberId: idSchema.optional(),
})

export const previewDestructiveSchema = z.object({
  action: destructiveActionSchema,
  target: destructiveTargetSchema,
})

export const confirmedExpenseActionSchema = z.object({
  walletId: idSchema,
  expenseId: idSchema,
  confirmationId: idSchema,
})
export const confirmedCategoryActionSchema = z.object({
  walletId: idSchema,
  categoryId: idSchema,
  confirmationId: idSchema,
})
export const confirmedMemberActionSchema = z.object({
  walletId: idSchema,
  memberId: idSchema,
  confirmationId: idSchema,
})
export const confirmedWalletActionSchema = z.object({
  walletId: idSchema,
  confirmationId: idSchema,
})
