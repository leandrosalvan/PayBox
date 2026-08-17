import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { defaultCurrency, defaultLocale } from '@/lib/locales'
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
    return res.status(200).json({ wallets: memberships.map((m: any) => m.wallet) })
  }

  if (req.method === 'POST') {
    const { name, locale = defaultLocale, currency = defaultCurrency, salaryMode = 'joint' } = req.body
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' })

    const wallet = await createWalletCommand(userId, { name, locale, currency, salaryMode })

    return res.status(201).json(wallet)
  }

  return res.status(405).end()
}
