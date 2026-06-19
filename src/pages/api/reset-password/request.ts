import type { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/mail'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'E-mail inválido' })

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    // Não revelar se o e-mail existe
    return res.status(200).json({ message: 'Se o e-mail existir, enviaremos um link.' })
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      email,
      token,
      expiresAt,
    },
  })

  try {
    await sendPasswordResetEmail(email, token)
  } catch (err) {
    console.error('Erro ao enviar e-mail:', err)
    return res.status(500).json({ error: 'Erro ao enviar e-mail' })
  }

  return res.status(200).json({ message: 'E-mail enviado' })
}
