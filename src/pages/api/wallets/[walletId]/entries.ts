import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { requireWalletMember } from '@/lib/wallet'
import { getMonthRange, parseMonth } from '@/lib/expenses'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

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
    const { month } = req.query
    const where: { walletId: string; receivedAt?: { gte: Date; lte: Date } } = { walletId }
    if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
      const { year, month: m } = parseMonth(month)
      const { start, end } = getMonthRange(year, m)
      where.receivedAt = { gte: start, lte: end }
    }
    const entries = await prisma.incomeEntry.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { receivedAt: 'asc' },
    })
    return res.status(200).json({ entries })
  }

  if (req.method === 'POST') {
    const { description, amount, receivedAt } = req.body ?? {}
    if (
      typeof description !== 'string' ||
      !description.trim() ||
      description.length > 200 ||
      !Number.isSafeInteger(amount) ||
      amount <= 0 ||
      typeof receivedAt !== 'string' ||
      !DATE_PATTERN.test(receivedAt) ||
      Number.isNaN(new Date(`${receivedAt}T00:00:00.000Z`).getTime())
    ) {
      return res.status(400).json({ error: 'Dados inválidos' })
    }
    const entry = await prisma.incomeEntry.create({
      data: {
        walletId,
        description: description.trim(),
        amount,
        receivedAt: new Date(`${receivedAt}T00:00:00.000Z`),
        createdById: userId,
      },
    })
    return res.status(201).json(entry)
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (typeof id !== 'string') return res.status(400).json({ error: 'ID inválido' })
    const removed = await prisma.incomeEntry.deleteMany({ where: { id, walletId } })
    if (removed.count !== 1) return res.status(404).json({ error: 'Receita não encontrada' })
    return res.status(204).end()
  }

  return res.status(405).end()
}
