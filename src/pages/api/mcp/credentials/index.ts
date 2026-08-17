import type { NextApiRequest, NextApiResponse } from 'next'
import { z } from 'zod/v4'
import { requireAuth } from '@/lib/api-auth'
import { generateMcpCredential, MAX_ACTIVE_MCP_CREDENTIALS } from '@/lib/mcp/credentials'
import { hasMcpWriteScope, MCP_SCOPES, serializeMcpScopes } from '@/lib/mcp/scopes'
import { prisma } from '@/lib/prisma'

const createCredentialSchema = z.object({
  name: z.string().trim().min(1).max(50),
  scopes: z.array(z.enum(MCP_SCOPES)).max(MCP_SCOPES.length).default(['read']),
})

function credentialView(credential: {
  id: string
  name: string
  tokenPrefix: string
  scopesText: string
  writeEnabled: boolean
  createdAt: Date
}) {
  return {
    id: credential.id,
    name: credential.name,
    tokenPrefix: credential.tokenPrefix,
    scopes: credential.scopesText.split(',').filter(Boolean),
    writeEnabled: credential.writeEnabled,
    createdAt: credential.createdAt.toISOString(),
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireAuth(req, res)
  if (!userId) return
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    const credentials = await prisma.mcpCredential.findMany({
      where: { userId, revokedAt: null },
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        scopesText: true,
        writeEnabled: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return res.status(200).json({ credentials: credentials.map(credentialView) })
  }

  if (req.method === 'POST') {
    const parsed = createCredentialSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: 'Configuração da integração inválida' })

    const activeCredentials = await prisma.mcpCredential.count({ where: { userId, revokedAt: null } })
    if (activeCredentials >= MAX_ACTIVE_MCP_CREDENTIALS) {
      return res.status(409).json({ error: `Limite de ${MAX_ACTIVE_MCP_CREDENTIALS} integrações ativas atingido` })
    }

    const generated = generateMcpCredential()
    const credential = await prisma.mcpCredential.create({
      data: {
        userId,
        name: parsed.data.name,
        tokenHash: generated.tokenHash,
        tokenPrefix: generated.tokenPrefix,
        scopesText: serializeMcpScopes(parsed.data.scopes),
        writeEnabled: hasMcpWriteScope(parsed.data.scopes),
      },
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        scopesText: true,
        writeEnabled: true,
        createdAt: true,
      },
    })

    return res.status(201).json({ credential: credentialView(credential), token: generated.token })
  }

  res.setHeader('Allow', ['GET', 'POST'])
  return res.status(405).json({ error: 'Método não permitido' })
}
