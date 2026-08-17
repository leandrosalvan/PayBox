import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { requireWalletMember } from '@/lib/wallet'
import { setExpensePaymentCommand } from '@/server/paybox/expense-commands'

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

  const { paidById, status, expectedUpdatedAt, paidAt } = req.body
  if ((status !== 'paid' && status !== 'pending') || typeof expectedUpdatedAt !== 'string') {
    return res.status(400).json({ error: 'Estado de pagamento e versão são obrigatórios' })
  }

  const expense = await prisma.expense.findFirst({ where: { id: expenseId, walletId } })
  if (!expense) return res.status(404).json({ error: 'Despesa não encontrada' })

  try {
    const updated = await setExpensePaymentCommand(userId, {
      walletId,
      expenseId,
      status,
      paidById: paidById || expense.paidById || undefined,
      paidAt,
      expectedUpdatedAt,
    })
    return res.status(200).json(updated)
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 409) {
      return res.status(409).json({ error: 'Despesa foi alterada; atualize a página' })
    }
    throw error
  }
}
