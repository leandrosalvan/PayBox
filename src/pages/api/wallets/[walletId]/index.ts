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

  if (req.method === 'GET') {
    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
        categories: true,
      },
    })
    if (!wallet) return res.status(404).json({ error: 'Carteira não encontrada' })
    return res.status(200).json(wallet)
  }

  if (req.method === 'PUT') {
    const { name, locale, currency, salaryMode } = req.body
    const wallet = await prisma.wallet.update({
      where: { id: walletId },
      data: { name, locale, currency, salaryMode },
    })
    return res.status(200).json(wallet)
  }

  if (req.method === 'DELETE') {
    await prisma.wallet.delete({ where: { id: walletId } })
    return res.status(204).end()
  }

  return res.status(405).end()
}
