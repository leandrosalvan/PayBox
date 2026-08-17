import { createHash, timingSafeEqual } from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { hashMcpToken, MCP_TOKEN_PREFIX } from '@/lib/mcp/credentials'
import { McpHttpError } from '@/lib/mcp/errors'
import { getMcpRequestId, sendMcpError } from '@/lib/mcp/http'
import { parseMcpScopes, type McpScope } from '@/lib/mcp/scopes'

export { MCP_SCOPES, type McpScope } from '@/lib/mcp/scopes'

export type McpIdentity = {
  userId: string
  email: string
  scopes: ReadonlySet<McpScope>
  credentialId?: string
}

function hashToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest()
}

export function tokenMatches(provided: string, configured: string) {
  return timingSafeEqual(hashToken(provided), hashToken(configured))
}

export function getConfiguredScopes(raw = process.env.PAYBOX_MCP_SCOPES): ReadonlySet<McpScope> {
  return parseMcpScopes(raw || '')
}

function getBearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    throw new McpHttpError(401, 'AUTHENTICATION_REQUIRED', 'Autenticação obrigatória')
  }
  const token = authorization.slice('Bearer '.length).trim()
  if (!token) throw new McpHttpError(401, 'INVALID_TOKEN', 'Token inválido')
  return token
}

async function authenticateUserCredential(providedToken: string, requiredScope: McpScope) {
  const credential = await prisma.mcpCredential.findUnique({
    where: { tokenHash: hashMcpToken(providedToken) },
    select: {
      id: true,
      scopesText: true,
      writeEnabled: true,
      revokedAt: true,
      user: { select: { id: true, email: true } },
    },
  })
  if (!credential || credential.revokedAt || !credential.user.email) return null

  const scopes = parseMcpScopes(credential.scopesText)
  if (requiredScope !== 'read' && !credential.writeEnabled) {
    throw new McpHttpError(503, 'MCP_WRITE_DISABLED', 'Escrita MCP desativada nesta integração')
  }
  if (!scopes.has(requiredScope)) {
    throw new McpHttpError(403, 'INSUFFICIENT_SCOPE', 'Escopo insuficiente')
  }

  return {
    userId: credential.user.id,
    email: credential.user.email,
    scopes,
    credentialId: credential.id,
  } satisfies McpIdentity
}

async function authenticateLegacyCredential(providedToken: string, requiredScope: McpScope) {
  const configuredToken = process.env.PAYBOX_MCP_TOKEN
  const configuredEmail = process.env.PAYBOX_MCP_USER_EMAIL?.trim().toLowerCase()
  if (!configuredToken || Buffer.byteLength(configuredToken, 'utf8') < 32 || !configuredEmail) return null
  if (!tokenMatches(providedToken, configuredToken)) return null

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
  return { userId: user.id, email: user.email, scopes } satisfies McpIdentity
}

export async function authenticateMcpRequest(
  req: NextApiRequest,
  requiredScope: McpScope
): Promise<McpIdentity> {
  const providedToken = getBearerToken(req)
  const userCredential = providedToken.startsWith(MCP_TOKEN_PREFIX)
    ? await authenticateUserCredential(providedToken, requiredScope)
    : null
  if (userCredential) return userCredential
  const legacyCredential = await authenticateLegacyCredential(providedToken, requiredScope)
  if (legacyCredential) return legacyCredential
  throw new McpHttpError(401, 'INVALID_TOKEN', 'Token inválido')
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
