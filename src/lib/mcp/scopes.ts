import { McpHttpError } from '@/lib/mcp/errors'

export const MCP_SCOPES = [
  'read',
  'write:expenses',
  'write:categories',
  'write:wallets',
  'admin:wallets',
  'admin:members',
] as const

export type McpScope = (typeof MCP_SCOPES)[number]

export function parseMcpScopes(raw: string): ReadonlySet<McpScope> {
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const invalid = values.find((value) => !MCP_SCOPES.includes(value as McpScope))
  if (invalid) {
    throw new McpHttpError(503, 'AUTH_CONFIGURATION_ERROR', 'Configuração MCP inválida')
  }
  return new Set(values as McpScope[])
}

export function serializeMcpScopes(scopes: readonly McpScope[]) {
  const selected = new Set<McpScope>(['read', ...scopes])
  return MCP_SCOPES.filter((scope) => selected.has(scope)).join(',')
}

export function hasMcpWriteScope(scopes: readonly McpScope[]) {
  return scopes.some((scope) => scope !== 'read')
}
