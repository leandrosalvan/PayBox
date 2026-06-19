import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { defaultCurrency, defaultLocale } from '@/lib/locales'

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

    const wallet = await prisma.wallet.create({
      data: {
        name,
        locale,
        currency,
        salaryMode,
        members: { create: { userId, salary: 0 } },
      },
    })

    // Categorias padrão
    const defaultCategories = [
      { name: 'Alimentação', color: '#10b981', icon: 'utensils' },
      { name: 'Transporte', color: '#3b82f6', icon: 'bus' },
      { name: 'Moradia', color: '#f59e0b', icon: 'home' },
      { name: 'Saúde', color: '#ef4444', icon: 'heart-pulse' },
      { name: 'Lazer', color: '#8b5cf6', icon: 'gamepad-2' },
      { name: 'Educação', color: '#06b6d4', icon: 'graduation-cap' },
      { name: 'Outros', color: '#64748b', icon: 'more-horizontal' },
    ]

    await prisma.category.createMany({
      data: defaultCategories.map((c) => ({ ...c, walletId: wallet.id })),
    })

    return res.status(201).json(wallet)
  }

  return res.status(405).end()
}
