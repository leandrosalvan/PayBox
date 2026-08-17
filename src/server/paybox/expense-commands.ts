import { prisma } from '@/lib/prisma'
import { requireWalletCapability } from '@/lib/mcp/authorization'
import { McpHttpError } from '@/lib/mcp/errors'
import { serializeExpense } from '@/server/paybox/serializers'
import { assertCategoryInWallet, assertUserInWallet, parseCivilDate } from '@/server/paybox/validation'

const expenseInclude = {
  category: { select: { id: true, name: true, color: true, icon: true } },
  paidBy: { select: { id: true, name: true } },
  series: { select: { id: true, type: true, totalInstallments: true } },
} as const

function utcDueDate(year: number, monthIndex: number, dueDay: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, monthIndex, Math.min(dueDay, lastDay)))
}

function generateUtcSeriesInstances(options: {
  walletId: string
  seriesId: string
  startDate: Date
  dueDay: number
  count: number
  description: string
  amount: number
  categoryId: string | null
  paidById: string | null
  createdById: string
  type: 'single' | 'fixed' | 'installment'
  installmentStart?: number
}) {
  return Array.from({ length: options.count }, (_, index) => ({
    seriesId: options.seriesId,
    walletId: options.walletId,
    description: options.description,
    amount: options.amount,
    dueDate: utcDueDate(
      options.startDate.getUTCFullYear(),
      options.startDate.getUTCMonth() + index,
      options.dueDay
    ),
    status: 'pending',
    installmentNumber: options.type === 'installment' ? (options.installmentStart ?? 1) + index : null,
    categoryId: options.categoryId,
    paidById: options.paidById,
    createdById: options.createdById,
  }))
}

async function getCurrency(walletId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId }, select: { currency: true } })
  if (!wallet) throw new McpHttpError(404, 'NOT_FOUND', 'Carteira não encontrada')
  return wallet.currency
}

export async function createExpenseCommand(userId: string, walletId: string, input: {
  description: string
  amountInCents: number
  currency: string
  dueDate: string
  categoryId?: string | null
  type: 'single' | 'fixed' | 'installment'
  totalInstallments?: number
  paidById?: string | null
}) {
  await requireWalletCapability(userId, walletId, 'write:expenses')
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId }, select: { currency: true } })
  if (!wallet || wallet.currency !== input.currency) throw new McpHttpError(400, 'VALIDATION_ERROR', 'Moeda diferente da carteira')
  const startDate = parseCivilDate(input.dueDate)
  const count = input.type === 'fixed' ? 12 : input.type === 'installment' ? input.totalInstallments! : 1
  const dueDay = startDate.getUTCDate()

  return prisma.$transaction(async (tx) => {
    await assertCategoryInWallet(tx, walletId, input.categoryId)
    await assertUserInWallet(tx, walletId, input.paidById)
    const series = await tx.expenseSeries.create({
      data: {
        walletId,
        description: input.description,
        amount: input.amountInCents,
        dueDay,
        categoryId: input.categoryId ?? null,
        startDate,
        endDate: count > 1 ? new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + count, 1)) : null,
        type: input.type,
        totalInstallments: input.type === 'installment' ? count : null,
        createdById: userId,
        paidByDefaultId: input.paidById ?? userId,
      },
    })
    const instances = generateUtcSeriesInstances({
      walletId,
      seriesId: series.id,
      startDate,
      dueDay,
      count,
      description: input.description,
      amount: input.amountInCents,
      categoryId: input.categoryId ?? null,
      paidById: input.paidById ?? userId,
      createdById: userId,
      type: input.type,
    })
    await tx.expense.createMany({ data: instances })
    const expenses = await tx.expense.findMany({ where: { seriesId: series.id }, include: expenseInclude, orderBy: { dueDate: 'asc' } })
    return {
      series: { id: series.id, type: series.type, totalInstallments: series.totalInstallments },
      expenses: expenses.map((expense) => serializeExpense(expense, wallet.currency)),
      affectedCount: expenses.length,
    }
  })
}

export async function updateExpenseCommand(userId: string, input: {
  walletId: string
  expenseId: string
  changes: { description?: string; amountInCents?: number; dueDate?: string; categoryId?: string | null; paidById?: string | null }
  expectedUpdatedAt: string
}) {
  await requireWalletCapability(userId, input.walletId, 'write:expenses')
  const currency = await getCurrency(input.walletId)
  return prisma.$transaction(async (tx) => {
    await assertCategoryInWallet(tx, input.walletId, input.changes.categoryId)
    await assertUserInWallet(tx, input.walletId, input.changes.paidById)
    const data = {
      ...(input.changes.description !== undefined ? { description: input.changes.description } : {}),
      ...(input.changes.amountInCents !== undefined ? { amount: input.changes.amountInCents } : {}),
      ...(input.changes.dueDate !== undefined ? { dueDate: parseCivilDate(input.changes.dueDate) } : {}),
      ...(input.changes.categoryId !== undefined ? { categoryId: input.changes.categoryId } : {}),
      ...(input.changes.paidById !== undefined ? { paidById: input.changes.paidById } : {}),
    }
    const changed = await tx.expense.updateMany({
      where: { id: input.expenseId, walletId: input.walletId, updatedAt: new Date(input.expectedUpdatedAt) },
      data,
    })
    if (changed.count !== 1) throw new McpHttpError(409, 'CONFLICT', 'Despesa alterada por outra operação')
    const expense = await tx.expense.findFirst({ where: { id: input.expenseId, walletId: input.walletId }, include: expenseInclude })
    if (!expense) throw new McpHttpError(404, 'NOT_FOUND', 'Despesa não encontrada')
    return serializeExpense(expense, currency)
  })
}

export async function setExpensePaymentCommand(userId: string, input: {
  walletId: string
  expenseId: string
  status: 'paid' | 'pending'
  paidById?: string
  paidAt?: string
  expectedUpdatedAt: string
}) {
  await requireWalletCapability(userId, input.walletId, 'write:expenses')
  const currency = await getCurrency(input.walletId)
  return prisma.$transaction(async (tx) => {
    const payer = input.status === 'paid' ? input.paidById ?? userId : null
    await assertUserInWallet(tx, input.walletId, payer)
    const changed = await tx.expense.updateMany({
      where: { id: input.expenseId, walletId: input.walletId, updatedAt: new Date(input.expectedUpdatedAt) },
      data: {
        status: input.status,
        paidAt: input.status === 'paid' ? (input.paidAt ? new Date(input.paidAt) : new Date()) : null,
        paidById: payer,
      },
    })
    if (changed.count !== 1) throw new McpHttpError(409, 'CONFLICT', 'Despesa alterada por outra operação')
    const expense = await tx.expense.findFirst({ where: { id: input.expenseId, walletId: input.walletId }, include: expenseInclude })
    if (!expense) throw new McpHttpError(404, 'NOT_FOUND', 'Despesa não encontrada')
    return serializeExpense(expense, currency)
  })
}

export async function duplicateExpenseAsRecurringCommand(userId: string, input: {
  walletId: string; expenseId: string; startMonth: string
}) {
  await requireWalletCapability(userId, input.walletId, 'write:expenses')
  const source = await prisma.expense.findFirst({ where: { id: input.expenseId, walletId: input.walletId } })
  if (!source) throw new McpHttpError(404, 'NOT_FOUND', 'Despesa não encontrada')
  const startDate = parseCivilDate(`${input.startMonth}-01`)
  const dueDay = source.dueDate.getUTCDate()
  const dueDate = utcDueDate(startDate.getUTCFullYear(), startDate.getUTCMonth(), dueDay)
  return createExpenseCommand(userId, input.walletId, {
    description: source.description,
    amountInCents: source.amount,
    currency: await getCurrency(input.walletId),
    dueDate: dueDate.toISOString().slice(0, 10),
    categoryId: source.categoryId,
    type: 'fixed',
    paidById: source.paidById,
  })
}

export async function convertExpenseToInstallmentsCommand(userId: string, input: {
  walletId: string; expenseId: string; installments: number
}) {
  await requireWalletCapability(userId, input.walletId, 'write:expenses')
  return prisma.$transaction(async (tx) => {
    const expense = await tx.expense.findFirst({ where: { id: input.expenseId, walletId: input.walletId }, include: { series: true } })
    if (!expense?.series) throw new McpHttpError(404, 'NOT_FOUND', 'Série da despesa não encontrada')
    await tx.expense.deleteMany({ where: { seriesId: expense.series.id, dueDate: { gt: expense.dueDate } } })
    const instances = generateUtcSeriesInstances({
      walletId: input.walletId,
      seriesId: expense.series.id,
      startDate: new Date(Date.UTC(expense.dueDate.getUTCFullYear(), expense.dueDate.getUTCMonth() + 1, 1)),
      dueDay: expense.series.dueDay,
      count: input.installments - 1,
      description: expense.series.description,
      amount: expense.series.amount,
      categoryId: expense.series.categoryId,
      paidById: expense.series.paidByDefaultId,
      createdById: expense.series.createdById,
      type: 'installment',
      installmentStart: 2,
    })
    await tx.expense.createMany({ data: instances })
    await tx.expense.update({ where: { id: expense.id }, data: { installmentNumber: 1 } })
    await tx.expenseSeries.update({
      where: { id: expense.series.id },
      data: {
        type: 'installment',
        totalInstallments: input.installments,
        endDate: instances.at(-1)?.dueDate ?? expense.dueDate,
      },
    })
    return { seriesId: expense.series.id, affectedCount: input.installments, totalInstallments: input.installments }
  })
}
