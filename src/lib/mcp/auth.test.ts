import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockRequest, createMockResponse } from '@/test/next-api'

const { userFindUnique, credentialFindUnique } = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  credentialFindUnique: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    mcpCredential: { findUnique: credentialFindUnique },
  },
}))

import { authenticateMcpRequest, requireMcpIdentity, tokenMatches } from '@/lib/mcp/auth'

const TEST_TOKEN = 'token-seguro-de-teste-com-32-bytes'
const USER_TOKEN = 'pbx_mcp_token-seguro-de-usuario-com-32-bytes'

describe('autenticação MCP', () => {
  beforeEach(() => {
    vi.stubEnv('PAYBOX_MCP_TOKEN', TEST_TOKEN)
    vi.stubEnv('PAYBOX_MCP_USER_EMAIL', 'mcp@example.com')
    vi.stubEnv('PAYBOX_MCP_SCOPES', 'read,write:expenses')
    vi.stubEnv('PAYBOX_MCP_WRITE_ENABLED', 'false')
    userFindUnique.mockResolvedValue({ id: 'user-1', email: 'mcp@example.com' })
    credentialFindUnique.mockResolvedValue(null)
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
    expect(JSON.stringify(res.payload)).not.toContain(TEST_TOKEN)
  })

  it('recusa token inválido', async () => {
    const req = createMockRequest({ headers: { authorization: 'Bearer errado' } })
    await expect(authenticateMcpRequest(req, 'read')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
    })
  })

  it('recusa credencial quando não há configuração global correspondente', async () => {
    vi.stubEnv('PAYBOX_MCP_TOKEN', '')
    const req = createMockRequest({ headers: { authorization: `Bearer ${TEST_TOKEN}` } })
    await expect(authenticateMcpRequest(req, 'read')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
    })
  })

  it('não aceita token global configurado com menos de 32 bytes', async () => {
    vi.stubEnv('PAYBOX_MCP_TOKEN', 'token-curto')
    const req = createMockRequest({ headers: { authorization: 'Bearer token-curto' } })
    await expect(authenticateMcpRequest(req, 'read')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
    })
  })

  it('recusa usuário configurado inexistente', async () => {
    userFindUnique.mockResolvedValue(null)
    const req = createMockRequest({
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    await expect(authenticateMcpRequest(req, 'read')).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    })
  })

  it('recusa escopo ausente', async () => {
    vi.stubEnv('PAYBOX_MCP_SCOPES', 'read')
    vi.stubEnv('PAYBOX_MCP_WRITE_ENABLED', 'true')
    const req = createMockRequest({
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    await expect(authenticateMcpRequest(req, 'write:expenses')).rejects.toMatchObject({
      statusCode: 403,
      code: 'INSUFFICIENT_SCOPE',
    })
  })

  it('aplica a trava geral de escrita', async () => {
    const req = createMockRequest({
      headers: { authorization: `Bearer ${TEST_TOKEN}` },
    })
    await expect(authenticateMcpRequest(req, 'write:expenses')).rejects.toMatchObject({
      statusCode: 503,
      code: 'MCP_WRITE_DISABLED',
    })
  })

  it('autentica credencial criada pelo próprio usuário', async () => {
    credentialFindUnique.mockResolvedValue({
      id: 'credential-1',
      scopesText: 'read',
      writeEnabled: false,
      revokedAt: null,
      user: { id: 'user-2', email: 'usuario@example.com' },
    })
    const req = createMockRequest({ headers: { authorization: `Bearer ${USER_TOKEN}` } })
    await expect(authenticateMcpRequest(req, 'read')).resolves.toMatchObject({
      userId: 'user-2',
      credentialId: 'credential-1',
    })
  })

  it('recusa escrita desativada na credencial do usuário', async () => {
    credentialFindUnique.mockResolvedValue({
      id: 'credential-1',
      scopesText: 'read,write:expenses',
      writeEnabled: false,
      revokedAt: null,
      user: { id: 'user-2', email: 'usuario@example.com' },
    })
    const req = createMockRequest({ headers: { authorization: `Bearer ${USER_TOKEN}` } })
    await expect(authenticateMcpRequest(req, 'write:expenses')).rejects.toMatchObject({
      statusCode: 503,
      code: 'MCP_WRITE_DISABLED',
    })
  })

  it('recusa credencial revogada', async () => {
    credentialFindUnique.mockResolvedValue({
      id: 'credential-1',
      scopesText: 'read',
      writeEnabled: false,
      revokedAt: new Date(),
      user: { id: 'user-2', email: 'usuario@example.com' },
    })
    const req = createMockRequest({ headers: { authorization: `Bearer ${USER_TOKEN}` } })
    await expect(authenticateMcpRequest(req, 'read')).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_TOKEN',
    })
  })
})
