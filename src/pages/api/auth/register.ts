import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { email, password, name } = req.body

    if (!email || !password || password.length < 6) {
      return res.status(400).json({ error: 'Dados inválidos' })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ error: 'E-mail já cadastrado' })
    }

    const hashed = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name || null,
      },
    })

    return res.status(201).json({ id: user.id, email: user.email })
  } catch (error: any) {
    console.error('REGISTER_ERROR', error)
    return res.status(500).json({ error: 'Erro ao criar conta', detail: error.message })
  }
}
