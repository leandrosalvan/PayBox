import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { defaultCurrency, defaultLocale } from '@/lib/locales'
import { getMonthRange } from '@/lib/expenses'
import { createWalletCommand } from '@/server/paybox/wallet-commands'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireAuth(req, res)
  if (!userId) return

  if (req.method === 'GET') {
    const memberships = await prisma.walletMember.findMany({
      where: { userId },
      include: {
        wallet: { include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } } },
      },
      orderBy: { joinedAt: 'desc' },
    })
    const wallets = memberships.map((m: any) => m.wallet)

    // Resumo do mês corrente de cada carteira (atrasado = não pago com vencimento anterior a hoje).
    const now = new Date()
    const { start, end } = getMonthRange(now.getUTCFullYear(), now.getUTCMonth())
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const monthExpenses = await prisma.expense.findMany({
      where: { walletId: { in: wallets.map((w: any) => w.id) }, dueDate: { gte: start, lte: end } },
      select: { walletId: true, amount: true, status: true, dueDate: true },
    })
    const summaries = new Map<string, { paid: number; pending: number; overdue: number; overdueCount: number }>()
    for (const e of monthExpenses) {
      const summary = summaries.get(e.walletId) ?? { paid: 0, pending: 0, overdue: 0, overdueCount: 0 }
      if (e.status === 'paid') summary.paid += e.amount
      else if (e.dueDate < today) {
        summary.overdue += e.amount
        summary.overdueCount += 1
      } else summary.pending += e.amount
      summaries.set(e.walletId, summary)
    }

    return res.status(200).json({
      wallets: wallets.map((w: any) => ({
        ...w,
        summary: summaries.get(w.id) ?? { paid: 0, pending: 0, overdue: 0, overdueCount: 0 },
      })),
    })
  }

  if (req.method === 'POST') {
    const { name, locale = defaultLocale, currency = defaultCurrency, salaryMode = 'joint' } = req.body
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' })

    const wallet = await createWalletCommand(userId, { name, locale, currency, salaryMode })

    return res.status(201).json(wallet)
  }

  return res.status(405).end()
}
