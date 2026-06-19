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
    const categories = await prisma.category.findMany({
      where: { walletId },
      orderBy: { name: 'asc' },
    })
    return res.status(200).json({ categories })
  }

  if (req.method === 'POST') {
    const { name, color, icon } = req.body
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' })
    try {
      const category = await prisma.category.create({
        data: { name, color: color || '#10b981', icon: icon || 'tag', walletId },
      })
      return res.status(201).json(category)
    } catch (e: any) {
      if (e.code === 'P2002') return res.status(400).json({ error: 'Categoria já existe' })
      throw e
    }
  }

  if (req.method === 'PUT') {
    const { id, name, color, icon } = req.body
    const category = await prisma.category.update({
      where: { id, walletId },
      data: { name, color, icon },
    })
    return res.status(200).json(category)
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (typeof id !== 'string') return res.status(400).json({ error: 'ID inválido' })
    await prisma.category.delete({ where: { id, walletId } })
    return res.status(204).end()
  }

  return res.status(405).end()
}
