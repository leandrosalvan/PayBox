import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireAuth(req, res)
  if (!userId) return

  if (req.method !== 'GET') return res.status(405).end()

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user?.email) return res.status(400).json({ error: 'E-mail não encontrado' })

  const invites = await prisma.walletInvite.findMany({
    where: { email: user.email, status: 'pending', expiresAt: { gt: new Date() } },
    include: { wallet: { select: { id: true, name: true, locale: true, currency: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return res.status(200).json({ invites })
}
