import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireAuth(req, res)
  if (!userId) return
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE'])
    return res.status(405).json({ error: 'Método não permitido' })
  }

  const credentialId = typeof req.query.credentialId === 'string' ? req.query.credentialId : ''
  const credential = await prisma.mcpCredential.findFirst({
    where: { id: credentialId, userId, revokedAt: null },
    select: { id: true },
  })
  if (!credential) return res.status(404).json({ error: 'Integração não encontrada' })

  await prisma.mcpCredential.update({
    where: { id: credential.id },
    data: { revokedAt: new Date() },
  })
  return res.status(204).end()
}
