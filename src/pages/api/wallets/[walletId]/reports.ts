import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { requireWalletMember } from '@/lib/wallet'
import { getMonthRange, parseMonth } from '@/lib/expenses'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireAuth(req, res)
  if (!userId) return

  const { walletId } = req.query
  if (typeof walletId !== 'string') return res.status(400).json({ error: 'ID inválido' })

  try {
    await requireWalletMember(walletId, userId)
  } catch {
    return res.status(403).json({ error: 'Acesso negado' })
  }

  if (req.method !== 'GET') return res.status(405).end()

  const { month } = req.query
  let year = new Date().getFullYear()
  let monthIndex = new Date().getMonth()
  if (typeof month === 'string') {
    const parsed = parseMonth(month)
    year = parsed.year
    monthIndex = parsed.month
  }
  const { start, end } = getMonthRange(year, monthIndex)

  const expenses = await prisma.expense.findMany({
    where: { walletId, dueDate: { gte: start, lte: end } },
    include: { category: { select: { id: true, name: true, color: true } } },
  })

  const totalPaid = expenses.filter((e: any) => e.status === 'paid').reduce((sum: number, e: any) => sum + e.amount, 0)
  const totalPending = expenses.filter((e: any) => e.status === 'pending').reduce((sum: number, e: any) => sum + e.amount, 0)
  const totalOverdue = expenses.filter((e: any) => e.status === 'overdue').reduce((sum: number, e: any) => sum + e.amount, 0)
  const total = totalPaid + totalPending + totalOverdue

  const byCategory: Record<string, { name: string; color: string; amount: number; paid: number; pending: number; overdue: number }> = {}
  for (const e of expenses) {
    const key = e.category?.id || 'none'
    if (!byCategory[key]) {
      byCategory[key] = {
        name: e.category?.name || 'Sem categoria',
        color: e.category?.color || '#94a3b8',
        amount: 0,
        paid: 0,
        pending: 0,
        overdue: 0,
      }
    }
    byCategory[key].amount += e.amount
    if (e.status === 'paid') byCategory[key].paid += e.amount
    if (e.status === 'pending') byCategory[key].pending += e.amount
    if (e.status === 'overdue') byCategory[key].overdue += e.amount
  }

  const evolution = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(year, monthIndex - i, 1)
    const { start: s, end: e } = getMonthRange(d.getFullYear(), d.getMonth())
    const monthExpenses = await prisma.expense.findMany({
      where: { walletId, dueDate: { gte: s, lte: e } },
    })
    evolution.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      paid: monthExpenses.filter((x: any) => x.status === 'paid').reduce((sum: number, x: any) => sum + x.amount, 0),
      pending: monthExpenses.filter((x: any) => x.status === 'pending').reduce((sum: number, x: any) => sum + x.amount, 0),
      overdue: monthExpenses.filter((x: any) => x.status === 'overdue').reduce((sum: number, x: any) => sum + x.amount, 0),
    })
  }

  return res.status(200).json({
    total,
    totalPaid,
    totalPending,
    totalOverdue,
    byCategory: Object.values(byCategory),
    evolution,
  })
}
