import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { requireWalletMember } from '@/lib/wallet'
import { assertOwnerCanBeRemoved } from '@/lib/mcp/authorization'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireAuth(req, res)
  if (!userId) return

  const { walletId } = req.query
  if (typeof walletId !== 'string') return res.status(400).json({ error: 'ID inválido' })

  let membership
  try {
    membership = await requireWalletMember(walletId, userId)
  } catch {
    return res.status(403).json({ error: 'Acesso negado' })
  }

  if (req.method === 'GET') {
    const members = await prisma.walletMember.findMany({
      where: { walletId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { joinedAt: 'asc' },
    })
    return res.status(200).json({ members })
  }

  if (req.method === 'PATCH') {
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Apenas o proprietário pode alterar salários' })
    const { memberId, salary } = req.body
    const member = await prisma.walletMember.update({
      where: { id: memberId, walletId },
      data: { salary: Number(salary) || 0 },
      include: { user: { select: { id: true, name: true, email: true } } },
    })
    return res.status(200).json(member)
  }

  if (req.method === 'DELETE') {
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Apenas o proprietário pode remover membros' })
    const { memberId } = req.query
    if (typeof memberId !== 'string') return res.status(400).json({ error: 'ID inválido' })

    try {
      await assertOwnerCanBeRemoved(walletId, memberId)
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode || 400
      return res.status(statusCode).json({ error: (error as Error).message })
    }
    await prisma.walletMember.delete({ where: { id: memberId, walletId } })
    return res.status(204).end()
  }

  return res.status(405).end()
}
