import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { requireWalletMember } from '@/lib/wallet'

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
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Apenas o proprietário pode editar a carteira' })
    const { name, locale, currency, salaryMode, expectedUpdatedAt } = req.body
    if (typeof expectedUpdatedAt !== 'string') return res.status(400).json({ error: 'Versão da carteira obrigatória' })
    const changed = await prisma.wallet.updateMany({
      where: { id: walletId, updatedAt: new Date(expectedUpdatedAt) },
      data: { name, locale, currency, salaryMode },
    })
    if (changed.count !== 1) return res.status(409).json({ error: 'Carteira foi alterada; atualize a página' })
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } })
    return res.status(200).json(wallet)
  }

  if (req.method === 'DELETE') {
    if (membership.role !== 'owner') return res.status(403).json({ error: 'Apenas o proprietário pode excluir a carteira' })
    await prisma.wallet.delete({ where: { id: walletId } })
    return res.status(204).end()
  }

  return res.status(405).end()
}
