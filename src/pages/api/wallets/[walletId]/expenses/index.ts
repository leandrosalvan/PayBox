import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { requireWalletMember } from '@/lib/wallet'
import { ExpenseType, generateSeriesInstances, getMonthRange, parseMonth, renewFixedSeriesIfNeeded, updateOverdueStatus } from '@/lib/expenses'

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

  if (req.method === 'GET') {
    const { month, lastSync } = req.query
    await renewFixedSeriesIfNeeded(walletId)
    await updateOverdueStatus(walletId)

    let where: any = { walletId }
    if (typeof month === 'string') {
      const { year, month: m } = parseMonth(month)
      const { start, end } = getMonthRange(year, m)
      where.dueDate = { gte: start, lte: end }
    }
    if (typeof lastSync === 'string' && lastSync) {
      const syncDate = new Date(lastSync)
      if (!isNaN(syncDate.getTime())) {
        where = {
          ...where,
          updatedAt: { gt: syncDate },
        }
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        paidBy: { select: { id: true, name: true, email: true } },
        series: { select: { id: true, type: true, totalInstallments: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    return res.status(200).json({ expenses, serverTime: new Date().toISOString() })
  }

  if (req.method === 'POST') {
    const {
      description,
      amount,
      dueDay,
      dueDate,
      categoryId,
      type,
      totalInstallments,
      paidById,
    } = req.body

    if (!description || typeof amount !== 'number' || !dueDay || !dueDate || !type) {
      return res.status(400).json({ error: 'Dados incompletos' })
    }

    const expenseType = type as ExpenseType
    const startDate = new Date(dueDate + 'T00:00:00')

    let endDate: Date | null = null
    let count = 1
    if (expenseType === 'fixed') {
      count = 12
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 12, 1)
    } else if (expenseType === 'installment') {
      const installments = Number(totalInstallments) || 1
      count = installments
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + installments, 1)
    }

    const series = await prisma.expenseSeries.create({
      data: {
        walletId,
        description,
        amount,
        dueDay: Number(dueDay),
        categoryId: categoryId || null,
        startDate,
        endDate,
        type: expenseType,
        totalInstallments: expenseType === 'installment' ? count : null,
        createdById: userId,
        paidByDefaultId: paidById || userId,
      },
    })

    const instances = generateSeriesInstances(
      walletId,
      series.id,
      startDate,
      series.dueDay,
      count,
      {
        description,
        amount,
        categoryId: categoryId || null,
        paidById: paidById || userId,
        createdById: userId,
      },
      expenseType
    )

    await prisma.expense.createMany({ data: instances })

    const createdExpenses = await prisma.expense.findMany({
      where: { seriesId: series.id },
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        paidBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { dueDate: 'asc' },
    })

    return res.status(201).json({ series, expenses: createdExpenses })
  }

  return res.status(405).end()
}
