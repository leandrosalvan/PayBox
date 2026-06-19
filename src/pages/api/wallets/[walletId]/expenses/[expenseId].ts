import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { requireWalletMember } from '@/lib/wallet'

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

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, walletId },
    include: {
      category: { select: { id: true, name: true, color: true, icon: true } },
      paidBy: { select: { id: true, name: true, email: true } },
      series: { select: { id: true, type: true, totalInstallments: true } },
    },
  })
  if (!expense) return res.status(404).json({ error: 'Despesa não encontrada' })

  if (req.method === 'GET') {
    return res.status(200).json(expense)
  }

  if (req.method === 'PUT') {
    const { description, amount, dueDate, categoryId, paidById } = req.body
    const data: any = {}
    if (description !== undefined) data.description = description
    if (typeof amount === 'number') data.amount = amount
    if (dueDate) data.dueDate = new Date(dueDate + 'T00:00:00')
    if (categoryId !== undefined) data.categoryId = categoryId || null
    if (paidById !== undefined) data.paidById = paidById || null

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data,
      include: {
        category: { select: { id: true, name: true, color: true, icon: true } },
        paidBy: { select: { id: true, name: true, email: true } },
        series: { select: { id: true, type: true, totalInstallments: true } },
      },
    })
    return res.status(200).json(updated)
  }

  if (req.method === 'DELETE') {
    await prisma.expense.delete({ where: { id: expenseId } })
    return res.status(204).end()
  }

  return res.status(405).end()
}
