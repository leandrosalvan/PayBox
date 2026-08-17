import { createHash, randomBytes } from 'node:crypto'

export const MAX_ACTIVE_MCP_CREDENTIALS = 5
export const MCP_TOKEN_PREFIX = 'pbx_mcp_'

export function hashMcpToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function generateMcpCredential() {
  const token = `${MCP_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
  return {
    token,
    tokenHash: hashMcpToken(token),
    tokenPrefix: `${token.slice(0, 16)}…`,
  }
}
