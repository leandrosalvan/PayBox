import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockRequest, createMockResponse } from '@/test/next-api'
import { MCP_TOKEN_PREFIX } from '@/lib/mcp/credentials'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/lib/api-auth', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/prisma', () => ({
  prisma: { mcpCredential: { findMany: mocks.findMany, count: mocks.count, create: mocks.create } },
}))

import handler from '@/pages/api/mcp/credentials'

describe('/api/mcp/credentials', () => {
  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue('user-1')
    mocks.findMany.mockResolvedValue([])
    mocks.count.mockResolvedValue(0)
    mocks.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'credential-1',
      name: data.name,
      tokenPrefix: data.tokenPrefix,
      scopesText: data.scopesText,
      writeEnabled: data.writeEnabled,
      createdAt: new Date('2026-08-17T10:00:00.000Z'),
    }))
  })

  it('cria uma credencial vinculada à sessão e mostra o token somente na resposta', async () => {
    const req = createMockRequest({
      method: 'POST',
      body: { name: 'Claude', scopes: ['read', 'write:expenses'] },
    })
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(201)
    expect(res.payload).toMatchObject({
      credential: { name: 'Claude', scopes: ['read', 'write:expenses'], writeEnabled: true },
    })
    const token = (res.payload as { token: string }).token
    expect(token.startsWith(MCP_TOKEN_PREFIX)).toBe(true)
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-1', name: 'Claude' }),
    }))
    const persisted = mocks.create.mock.calls[0][0].data
    expect(persisted.tokenHash).toHaveLength(64)
    expect(JSON.stringify(persisted)).not.toContain(token)
    expect(JSON.stringify(res.payload)).not.toContain(String(persisted.tokenHash))
  })

  it('mantém leitura obrigatória mesmo quando ela não vem no payload', async () => {
    const req = createMockRequest({
      method: 'POST',
      body: { name: 'Leitor', scopes: [] },
    })
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(201)
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ scopesText: 'read', writeEnabled: false })
  })

  it('lista somente metadados das credenciais da sessão', async () => {
    mocks.findMany.mockResolvedValue([{
      id: 'credential-1',
      name: 'Leitor',
      tokenPrefix: 'pbx_mcp_abcd…',
      scopesText: 'read',
      writeEnabled: false,
      createdAt: new Date('2026-08-17T10:00:00.000Z'),
    }])
    const req = createMockRequest({ method: 'GET' })
    const res = createMockResponse()

    await handler(req, res)

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', revokedAt: null } }))
    expect(JSON.stringify(res.payload)).not.toContain('tokenHash')
    expect(res.payload).toMatchObject({ credentials: [{ name: 'Leitor', scopes: ['read'] }] })
  })
})
