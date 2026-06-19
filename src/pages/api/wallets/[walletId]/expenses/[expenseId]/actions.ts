import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { requireWalletMember } from '@/lib/wallet'
import { generateSeriesInstances } from '@/lib/expenses'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireAuth(req, res)
  if (!userId) return

  const { walletId, expenseId } = req.query
  if (typeof walletId !== 'string' || typeof expenseId !== 'string') {
    return res.status(400).json({ error: 'IDs inválidos' })
  }

  try {
    await requireWalletMember(walletId, userId)
  } catch {
    return res.status(403).json({ error: 'Acesso negado' })
  }

  if (req.method !== 'POST') return res.status(405).end()

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, walletId },
    include: { series: true },
  })
  if (!expense) return res.status(404).json({ error: 'Despesa não encontrada' })

  const { action, installments } = req.body

  if (action === 'stop') {
    if (!expense.series) return res.status(400).json({ error: 'Despesa não é recorrente' })
    await prisma.expense.deleteMany({
      where: { seriesId: expense.series.id, dueDate: { gt: expense.dueDate } },
    })
    await prisma.expenseSeries.update({
      where: { id: expense.series.id },
      data: { endDate: expense.dueDate },
    })
    return res.status(200).json({ message: 'Recorrência parada' })
  }

  if (action === 'deleteFuture') {
    if (!expense.series) return res.status(400).json({ error: 'Despesa não faz parte de uma série' })
    await prisma.expense.deleteMany({
      where: { seriesId: expense.series.id, dueDate: { gte: expense.dueDate } },
    })
    const last = await prisma.expense.findFirst({
      where: { seriesId: expense.series.id },
      orderBy: { dueDate: 'desc' },
    })
    await prisma.expenseSeries.update({
      where: { id: expense.series.id },
      data: { endDate: last?.dueDate || new Date() },
    })
    return res.status(200).json({ message: 'Parcelas excluídas' })
  }

  if (action === 'deleteAll') {
    if (!expense.series) {
      await prisma.expense.delete({ where: { id: expenseId } })
    } else {
      await prisma.expenseSeries.delete({ where: { id: expense.series.id } })
    }
    return res.status(200).json({ message: 'Série excluída' })
  }

  if (action === 'convertToInstallments') {
    if (!expense.series) return res.status(400).json({ error: 'Despesa não faz parte de uma série' })
    const count = Number(installments) || 1
    await prisma.expense.deleteMany({
      where: { seriesId: expense.series.id, dueDate: { gt: expense.dueDate } },
    })

    const newInstances = generateSeriesInstances(
      walletId,
      expense.series.id,
      new Date(expense.dueDate.getFullYear(), expense.dueDate.getMonth() + 1, 1),
      expense.series.dueDay,
      count - 1,
      {
        description: expense.series.description,
        amount: expense.series.amount,
        categoryId: expense.series.categoryId,
        paidById: expense.series.paidByDefaultId,
        createdById: expense.series.createdById,
      },
      'installment',
      2
    )
    await prisma.expense.createMany({ data: newInstances })
    await prisma.expenseSeries.update({
      where: { id: expense.series.id },
      data: { type: 'installment', totalInstallments: count, endDate: new Date(newInstances[newInstances.length - 1]?.dueDate || expense.dueDate) },
    })
    await prisma.expense.update({
      where: { id: expenseId },
      data: { installmentNumber: 1 },
    })
    return res.status(200).json({ message: 'Convertido para parcelas' })
  }

  if (action === 'duplicate') {
    const series = expense.series || {
      description: expense.description,
      amount: expense.amount,
      dueDay: expense.dueDate.getDate(),
      categoryId: expense.categoryId,
      paidByDefaultId: expense.paidById,
    }
    const startDate = new Date()
    startDate.setDate(1)
    const newSeries = await prisma.expenseSeries.create({
      data: {
        walletId,
        description: series.description,
        amount: series.amount,
        dueDay: series.dueDay,
        categoryId: series.categoryId,
        startDate,
        endDate: new Date(startDate.getFullYear(), startDate.getMonth() + 12, 1),
        type: 'fixed',
        createdById: userId,
        paidByDefaultId: series.paidByDefaultId || userId,
      },
    })
    const instances = generateSeriesInstances(
      walletId,
      newSeries.id,
      startDate,
      newSeries.dueDay,
      12,
      {
        description: newSeries.description,
        amount: newSeries.amount,
        categoryId: newSeries.categoryId,
        paidById: newSeries.paidByDefaultId,
        createdById: userId,
      },
      'fixed'
    )
    await prisma.expense.createMany({ data: instances })
    return res.status(201).json({ message: 'Série duplicada' })
  }

  return res.status(400).json({ error: 'Ação inválida' })
}
