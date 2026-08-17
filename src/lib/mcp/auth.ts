import { createHash, timingSafeEqual } from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { McpHttpError } from '@/lib/mcp/errors'
import { getMcpRequestId, sendMcpError } from '@/lib/mcp/http'

export const MCP_SCOPES = [
  'read',
  'write:expenses',
  'write:categories',
  'write:wallets',
  'admin:wallets',
  'admin:members',
] as const

export type McpScope = (typeof MCP_SCOPES)[number]

export type McpIdentity = {
  userId: string
  email: string
  scopes: ReadonlySet<McpScope>
}

function hashToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest()
}

export function tokenMatches(provided: string, configured: string) {
  return timingSafeEqual(hashToken(provided), hashToken(configured))
}

export function getConfiguredScopes(raw = process.env.PAYBOX_MCP_SCOPES): ReadonlySet<McpScope> {
  const values = (raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const invalid = values.find((value) => !MCP_SCOPES.includes(value as McpScope))
  if (invalid) {
    throw new McpHttpError(503, 'AUTH_CONFIGURATION_ERROR', 'Configuração MCP inválida')
  }
  return new Set(values as McpScope[])
}

export async function authenticateMcpRequest(
  req: NextApiRequest,
  requiredScope: McpScope
): Promise<McpIdentity> {
  const configuredToken = process.env.PAYBOX_MCP_TOKEN
  const configuredEmail = process.env.PAYBOX_MCP_USER_EMAIL?.trim().toLowerCase()
  if (!configuredToken || !configuredEmail) {
    throw new McpHttpError(503, 'AUTH_CONFIGURATION_ERROR', 'MCP não configurado')
  }

  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    throw new McpHttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação obrigatória')
  }
  const providedToken = authorization.slice('Bearer '.length)
  if (!providedToken || !tokenMatches(providedToken, configuredToken)) {
    throw new McpHttpError(401, 'INVALID_TOKEN', 'Token inválido')
  }

  const scopes = getConfiguredScopes()
  if (requiredScope !== 'read' && process.env.PAYBOX_MCP_WRITE_ENABLED !== 'true') {
    throw new McpHttpError(503, 'MCP_WRITE_DISABLED', 'Escrita MCP desativada')
  }
  if (!scopes.has(requiredScope)) {
    throw new McpHttpError(403, 'INSUFFICIENT_SCOPE', 'Escopo insuficiente')
  }

  const user = await prisma.user.findUnique({
    where: { email: configuredEmail },
    select: { id: true, email: true },
  })
  if (!user?.email) {
    throw new McpHttpError(503, 'USER_NOT_FOUND', 'Usuário MCP não encontrado')
  }

  return { userId: user.id, email: user.email, scopes }
}

export async function requireMcpIdentity(
  req: NextApiRequest,
  res: NextApiResponse,
  requiredScope: McpScope
): Promise<McpIdentity | null> {
  try {
    return await authenticateMcpRequest(req, requiredScope)
  } catch (error) {
    sendMcpError(res, getMcpRequestId(req), error)
    return null
  }
}
