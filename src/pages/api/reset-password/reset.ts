import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { token, password } = req.body
  if (!token || !password || password.length < 6) {
    return res.status(400).json({ error: 'Dados inválidos' })
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  })

  if (!resetToken || resetToken.expiresAt < new Date()) {
    return res.status(400).json({ error: 'Token inválido ou expirado' })
  }

  const hashed = await hashPassword(password)

  await prisma.user.update({
    where: { email: resetToken.email },
    data: { password: hashed },
  })

  await prisma.passwordResetToken.delete({
    where: { id: resetToken.id },
  })

  return res.status(200).json({ message: 'Senha redefinida' })
}
