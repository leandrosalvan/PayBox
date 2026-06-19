import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireAuth(req, res)
  if (!userId) return

  const { token } = req.query
  if (typeof token !== 'string') return res.status(400).json({ error: 'Token inválido' })

  const invite = await prisma.walletInvite.findUnique({
    where: { token },
    include: { wallet: { select: { id: true, name: true } } },
  })

  if (!invite || invite.status !== 'pending' || invite.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Convite inválido ou expirado' })
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (user?.email !== invite.email) {
    return res.status(403).json({ error: 'Este convite é para outro e-mail' })
  }

  if (req.method === 'GET') {
    return res.status(200).json({ invite })
  }

  if (req.method === 'POST') {
    const existing = await prisma.walletMember.findUnique({
      where: { walletId_userId: { walletId: invite.walletId, userId } },
    })
    if (!existing) {
      await prisma.walletMember.create({
        data: { walletId: invite.walletId, userId, salary: 0 },
      })
    }
    await prisma.walletInvite.update({
      where: { id: invite.id },
      data: { status: 'accepted' },
    })
    return res.status(200).json({ message: 'Convite aceito', walletId: invite.walletId })
  }

  return res.status(405).end()
}
