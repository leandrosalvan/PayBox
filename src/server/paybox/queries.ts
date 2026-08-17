import { prisma } from '@/lib/prisma'
import { McpHttpError } from '@/lib/mcp/errors'
import { requireWalletCapability } from '@/lib/mcp/authorization'
import { effectiveExpenseStatus, maskEmail, serializeExpense } from '@/server/paybox/serializers'

function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new McpHttpError(400, 'VALIDATION_ERROR', 'Mês inválido')
  }
  const [year, monthNumber] = month.split('-').map(Number)
  const start = new Date(Date.UTC(year, monthNumber - 1, 1))
  const end = new Date(Date.UTC(year, monthNumber, 1))
  return { start, end }
}

const expenseSelect = {
  id: true,
  walletId: true,
  seriesId: true,
  description: true,
  amount: true,
  dueDate: true,
  paidAt: true,
  paidById: true,
  status: true,
  installmentNumber: true,
  categoryId: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, color: true, icon: true } },
  paidBy: { select: { id: true, name: true } },
  series: { select: { id: true, type: true, totalInstallments: true } },
} as const

async function walletCurrency(walletId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { id: walletId }, select: { currency: true } })
  if (!wallet) throw new McpHttpError(404, 'NOT_FOUND', 'Carteira não encontrada')
  return wallet.currency
}

export async function listWallets(userId: string) {
  const memberships = await prisma.walletMember.findMany({
    where: { userId },
    select: {
      role: true,
      joinedAt: true,
      wallet: {
        select: {
          id: true,
          name: true,
          locale: true,
          currency: true,
          salaryMode: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })
  return memberships.map(({ wallet, role }) => ({
    id: wallet.id,
    name: wallet.name,
    locale: wallet.locale,
    currency: wallet.currency,
    salaryMode: wallet.salaryMode,
    role: role === 'owner' ? 'owner' : 'member',
    memberCount: wallet._count.members,
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
  }))
}

export async function getWallet(userId: string, walletId: string) {
  const membership = await requireWalletCapability(userId, walletId, 'read')
  const wallet = await prisma.wallet.findUnique({
    where: { id: walletId },
    select: {
      id: true,
      name: true,
      locale: true,
      currency: true,
      salaryMode: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { members: true, categories: true, expenses: true } },
    },
  })
  if (!wallet) throw new McpHttpError(404, 'NOT_FOUND', 'Carteira não encontrada')
  return {
    ...wallet,
    role: membership.role,
    counts: wallet._count,
    _count: undefined,
    createdAt: wallet.createdAt.toISOString(),
    updatedAt: wallet.updatedAt.toISOString(),
  }
}

export async function listCategories(userId: string, walletId: string) {
  await requireWalletCapability(userId, walletId, 'read')
  return prisma.category.findMany({
    where: { walletId },
    select: { id: true, name: true, color: true, icon: true, createdAt: true },
    orderBy: { name: 'asc' },
  }).then((categories) => categories.map((category) => ({
    ...category,
    createdAt: category.createdAt.toISOString(),
  })))
}

export async function listMembers(userId: string, walletId: string) {
  await requireWalletCapability(userId, walletId, 'read')
  const members = await prisma.walletMember.findMany({
    where: { walletId },
    select: {
      id: true,
      salary: true,
      role: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { joinedAt: 'asc' },
  })
  return members.map((member) => ({
    id: member.id,
    userId: member.user.id,
    name: member.user.name,
    image: member.user.image,
    maskedEmail: maskEmail(member.user.email),
    salaryInCents: member.salary,
    role: member.role === 'owner' ? 'owner' : 'member',
    joinedAt: member.joinedAt.toISOString(),
  }))
}

export async function listExpenses(options: {
  userId: string
  walletId: string
  month: string
  status?: 'pending' | 'paid' | 'overdue'
  categoryId?: string
  cursor?: string
  limit: number
}) {
  await requireWalletCapability(options.userId, options.walletId, 'read')
  const { start, end } = monthRange(options.month)
  const currency = await walletCurrency(options.walletId)
  const now = new Date()
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const expenses = await prisma.expense.findMany({
    where: {
      walletId: options.walletId,
      dueDate: { gte: start, lt: end },
      ...(options.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options.status === 'paid' ? { status: 'paid' } : {}),
      ...(options.status === 'pending' ? { status: { not: 'paid' }, dueDate: { gte: start > today ? start : today, lt: end } } : {}),
      ...(options.status === 'overdue' ? { status: { not: 'paid' }, dueDate: { gte: start, lt: end < today ? end : today } } : {}),
    },
    select: expenseSelect,
    orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    take: options.limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  })
  const serialized = expenses.map((expense) => serializeExpense(expense, currency, now))
  const hasMore = serialized.length > options.limit
  const items = serialized.slice(0, options.limit)
  return { items, nextCursor: hasMore ? items.at(-1)?.id ?? null : null }
}

export async function getExpense(userId: string, walletId: string, expenseId: string) {
  await requireWalletCapability(userId, walletId, 'read')
  const [expense, currency] = await Promise.all([
    prisma.expense.findFirst({ where: { id: expenseId, walletId }, select: expenseSelect }),
    walletCurrency(walletId),
  ])
  if (!expense) throw new McpHttpError(404, 'NOT_FOUND', 'Despesa não encontrada')
  return serializeExpense(expense, currency)
}

export async function getMonthSummary(userId: string, walletId: string, month: string) {
  await requireWalletCapability(userId, walletId, 'read')
  const { start, end } = monthRange(month)
  const [wallet, expenses] = await Promise.all([
    prisma.wallet.findUnique({ where: { id: walletId }, select: { currency: true } }),
    prisma.expense.findMany({
      where: { walletId, dueDate: { gte: start, lt: end } },
      select: { amount: true, status: true, dueDate: true, category: { select: { id: true, name: true, color: true } } },
    }),
  ])
  if (!wallet) throw new McpHttpError(404, 'NOT_FOUND', 'Carteira não encontrada')
  const totals = { paid: 0, pending: 0, overdue: 0 }
  const byCategory = new Map<string, { id: string | null; name: string; color: string; amountInCents: number }>()
  const now = new Date()
  for (const expense of expenses) {
    totals[effectiveExpenseStatus(expense.status, expense.dueDate, now)] += expense.amount
    const key = expense.category?.id ?? 'none'
    const current = byCategory.get(key) ?? {
      id: expense.category?.id ?? null,
      name: expense.category?.name ?? 'Sem categoria',
      color: expense.category?.color ?? '#94a3b8',
      amountInCents: 0,
    }
    current.amountInCents += expense.amount
    byCategory.set(key, current)
  }
  return {
    month,
    currency: wallet.currency,
    totalInCents: totals.paid + totals.pending + totals.overdue,
    paidInCents: totals.paid,
    pendingInCents: totals.pending,
    overdueInCents: totals.overdue,
    byCategory: Array.from(byCategory.values()),
  }
}

export async function listRecurringExpenses(userId: string, walletId: string) {
  await requireWalletCapability(userId, walletId, 'read')
  const currency = await walletCurrency(walletId)
  const series = await prisma.expenseSeries.findMany({
    where: { walletId, type: { in: ['fixed', 'installment'] } },
    select: {
      id: true,
      description: true,
      amount: true,
      dueDay: true,
      startDate: true,
      endDate: true,
      type: true,
      totalInstallments: true,
      category: { select: { id: true, name: true, color: true, icon: true } },
      createdAt: true,
      updatedAt: true,
      _count: { select: { expenses: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return series.map((item) => ({
    id: item.id,
    description: item.description,
    amountInCents: item.amount,
    currency,
    dueDay: item.dueDay,
    startDate: item.startDate.toISOString().slice(0, 10),
    endDate: item.endDate?.toISOString().slice(0, 10) ?? null,
    type: item.type,
    totalInstallments: item.totalInstallments,
    instanceCount: item._count.expenses,
    category: item.category,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }))
}

export async function listPendingInvites(userId: string, email: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user?.email || user.email.toLowerCase() !== email.toLowerCase()) {
    throw new McpHttpError(403, 'FORBIDDEN', 'Ação não permitida')
  }
  const invites = await prisma.walletInvite.findMany({
    where: { email: user.email, status: 'pending', expiresAt: { gt: new Date() } },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      wallet: { select: { id: true, name: true, locale: true, currency: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return invites.map((invite) => ({
    id: invite.id,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    wallet: invite.wallet,
  }))
}
