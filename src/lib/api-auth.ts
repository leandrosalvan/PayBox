import { getServerSession } from 'next-auth/next'
import type { NextApiRequest, NextApiResponse } from 'next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'

export async function getSessionUser(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  if (!session?.user?.id) return null
  return session.user.id
}

export async function requireAuth(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getSessionUser(req, res)
  if (!userId) {
    res.status(401).json({ error: 'Não autorizado' })
    return null
  }
  return userId
}
