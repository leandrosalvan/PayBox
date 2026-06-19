import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query
  if (typeof token !== 'string') return res.status(400).json({ error: 'Token inválido' })

  const wallet = await prisma.wallet.findUnique({
    where: { inviteToken: token },
    select: { id: true, name: true, locale: true, currency: true },
  })
  if (!wallet) return res.status(404).json({ error: 'Convite inválido' })

  if (req.method === 'GET') {
    return res.status(200).json({ wallet })
  }

  if (req.method === 'POST') {
    const userId = await requireAuth(req, res)
    if (!userId) return

    const existing = await prisma.walletMember.findUnique({
      where: { walletId_userId: { walletId: wallet.id, userId } },
    })
    if (!existing) {
      await prisma.walletMember.create({
        data: { walletId: wallet.id, userId, salary: 0 },
      })
    }
    return res.status(200).json({ walletId: wallet.id })
  }

  return res.status(405).end()
}
