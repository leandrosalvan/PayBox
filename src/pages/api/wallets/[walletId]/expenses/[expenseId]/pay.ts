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

  if (req.method !== 'POST') return res.status(405).end()

  const { paidById } = req.body

  const expense = await prisma.expense.findFirst({ where: { id: expenseId, walletId } })
  if (!expense) return res.status(404).json({ error: 'Despesa não encontrada' })

  const isPaid = expense.status === 'paid'
  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: {
      status: isPaid ? 'pending' : 'paid',
      paidAt: isPaid ? null : new Date(),
      paidById: isPaid ? null : paidById || expense.paidById || userId,
    },
    include: {
      category: { select: { id: true, name: true, color: true, icon: true } },
      paidBy: { select: { id: true, name: true, email: true } },
      series: { select: { id: true, type: true, totalInstallments: true } },
    },
  })

  return res.status(200).json(updated)
}
