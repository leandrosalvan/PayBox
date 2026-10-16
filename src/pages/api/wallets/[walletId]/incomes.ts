import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { requireWalletMember } from '@/lib/wallet'

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

  if (req.method === 'POST') {
    const { memberId, description, amount } = req.body
    if (
      typeof memberId !== 'string' ||
      typeof description !== 'string' ||
      !description.trim() ||
      description.length > 80 ||
      !Number.isSafeInteger(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({ error: 'Dados inválidos' })
    }
    const member = await prisma.walletMember.findFirst({ where: { id: memberId, walletId }, select: { id: true } })
    if (!member) return res.status(404).json({ error: 'Membro não encontrado' })
    const income = await prisma.memberIncome.create({
      data: { memberId, description: description.trim(), amount },
    })
    return res.status(201).json(income)
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (typeof id !== 'string') return res.status(400).json({ error: 'ID inválido' })
    const removed = await prisma.memberIncome.deleteMany({ where: { id, member: { walletId } } })
    if (removed.count !== 1) return res.status(404).json({ error: 'Renda não encontrada' })
    return res.status(204).end()
  }

  return res.status(405).end()
}
