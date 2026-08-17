import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockRequest, createMockResponse } from '@/test/next-api'

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }))

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique } },
}))

import { authenticateMcpRequest, requireMcpIdentity, tokenMatches } from '@/lib/mcp/auth'

describe('autenticação MCP', () => {
  beforeEach(() => {
    vi.stubEnv('PAYBOX_MCP_TOKEN', 'token-seguro-de-teste')
    vi.stubEnv('PAYBOX_MCP_USER_EMAIL', 'mcp@example.com')
    vi.stubEnv('PAYBOX_MCP_SCOPES', 'read,write:expenses')
    vi.stubEnv('PAYBOX_MCP_WRITE_ENABLED', 'false')
    findUnique.mockResolvedValue({ id: 'user-1', email: 'mcp@example.com' })
  })

  it('compara tokens por seus hashes', () => {
    expect(tokenMatches('correto', 'correto')).toBe(true)
    expect(tokenMatches('errado', 'correto')).toBe(false)
  })

  it('recusa token ausente sem vazar o token configurado', async () => {
    const req = createMockRequest()
    const res = createMockResponse()
    await requireMcpIdentity(req, res, 'read')
    expect(res.statusCode).toBe(401)
    expect(JSON.stringify(res.payload)).not.toContain('token-seguro-de-teste')
  })

  it('recusa token inválido', async () => {
    const req = createMockRequest({ headers: { authorization: 'Bearer errado' } })
    await expect(authenticateMcpRequest(req, 'read')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
    })
  })

  it('recusa configuração obrigatória ausente', async () => {
    vi.stubEnv('PAYBOX_MCP_TOKEN', '')
    const req = createMockRequest()
    await expect(authenticateMcpRequest(req, 'read')).rejects.toMatchObject({
      statusCode: 503,
      code: 'AUTH_CONFIGURATION_ERROR',
    })
  })

  it('recusa usuário configurado inexistente', async () => {
    findUnique.mockResolvedValue(null)
    const req = createMockRequest({
      headers: { authorization: 'Bearer token-seguro-de-teste' },
    })
    await expect(authenticateMcpRequest(req, 'read')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    })
  })

  it('recusa escopo ausente', async () => {
    vi.stubEnv('PAYBOX_MCP_SCOPES', 'read')
    vi.stubEnv('PAYBOX_MCP_WRITE_ENABLED', 'true')
    const req = createMockRequest({
      headers: { authorization: 'Bearer token-seguro-de-teste' },
    })
    await expect(authenticateMcpRequest(req, 'write:expenses')).rejects.toMatchObject({
      statusCode: 403,
      code: 'INSUFFICIENT_SCOPE',
    })
  })

  it('aplica a trava geral de escrita', async () => {
    const req = createMockRequest({
      headers: { authorization: 'Bearer token-seguro-de-teste' },
    })
    await expect(authenticateMcpRequest(req, 'write:expenses')).rejects.toMatchObject({
      statusCode: 503,
      code: 'MCP_WRITE_DISABLED',
    })
  })
})
