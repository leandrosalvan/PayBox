import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireAuth(req, res)
  if (!userId) return

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, password: true },
  })
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })

  if (req.method === 'GET') {
    return res.status(200).json({ id: user.id, name: user.name, email: user.email, hasPassword: !!user.password })
  }

  if (req.method === 'PATCH') {
    const { name, currentPassword, newPassword } = req.body ?? {}

    if (newPassword !== undefined) {
      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' })
      }
      if (user.password) {
        if (typeof currentPassword !== 'string' || !(await verifyPassword(currentPassword, user.password))) {
          return res.status(400).json({ error: 'Senha atual incorreta' })
        }
      }
      await prisma.user.update({ where: { id: userId }, data: { password: await hashPassword(newPassword) } })
      return res.status(200).json({ ok: true })
    }

    if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
      return res.status(400).json({ error: 'Informe um nome válido (até 80 caracteres)' })
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { name: name.trim() },
      select: { name: true },
    })
    return res.status(200).json({ name: updated.name })
  }

  return res.status(405).end()
}
