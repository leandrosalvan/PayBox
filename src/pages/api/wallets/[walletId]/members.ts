import type { NextApiRequest, NextApiResponse } from 'next'
import { Prisma } from '@prisma/client'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { requireWalletMember } from '@/lib/wallet'

function memberRemovalError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode })
}

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
    if (typeof memberId !== 'string' || !Number.isSafeInteger(salary) || salary < 0) {
      return res.status(400).json({ error: 'Dados inválidos' })
    }
    try {
      const member = await prisma.walletMember.update({
        where: { id: memberId, walletId },
        data: { salary },
        include: { user: { select: { id: true, name: true, email: true } } },
      })
      return res.status(200).json(member)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ error: 'Membro não encontrado' })
      }
      return res.status(500).json({ error: 'Não foi possível alterar o salário' })
    }
  }

  if (req.method === 'DELETE') {
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Apenas o proprietário pode remover membros' })
    const { memberId } = req.query
    if (typeof memberId !== 'string') return res.status(400).json({ error: 'ID inválido' })

    try {
      await prisma.$transaction(
        async (tx) => {
          const member = await tx.walletMember.findFirst({
            where: { id: memberId, walletId },
            select: { role: true },
          })
          if (!member) throw memberRemovalError(404, 'Membro não encontrado')

          if (member.role === 'owner') {
            const ownerCount = await tx.walletMember.count({ where: { walletId, role: 'owner' } })
            if (ownerCount <= 1) {
              throw memberRemovalError(409, 'A carteira precisa manter ao menos um proprietário')
            }
          }

          await tx.walletMember.delete({ where: { id: memberId, walletId } })
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return res.status(409).json({ error: 'Conflito ao remover membro; tente novamente' })
      }
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode) return res.status(statusCode).json({ error: (error as Error).message })
      return res.status(500).json({ error: 'Não foi possível remover o membro' })
    }
    return res.status(204).end()
  }

  return res.status(405).end()
}
