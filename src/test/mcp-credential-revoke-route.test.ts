import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockRequest, createMockResponse } from '@/test/next-api'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/api-auth', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/prisma', () => ({
  prisma: { mcpCredential: { findFirst: mocks.findFirst, update: mocks.update } },
}))

import handler from '@/pages/api/mcp/credentials/[credentialId]'

describe('/api/mcp/credentials/[credentialId]', () => {
  beforeEach(() => {
    mocks.requireAuth.mockResolvedValue('user-1')
    mocks.findFirst.mockResolvedValue({ id: 'credential-1' })
    mocks.update.mockResolvedValue({ id: 'credential-1' })
  })

  it('revoga somente uma credencial pertencente ao usuário da sessão', async () => {
    const req = createMockRequest({
      method: 'DELETE',
      query: { credentialId: 'credential-1' },
    })
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(204)
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: 'credential-1', userId: 'user-1', revokedAt: null },
      select: { id: true },
    })
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 'credential-1' },
      data: { revokedAt: expect.any(Date) },
    })
  })

  it('não revela credencial de outro usuário', async () => {
    mocks.findFirst.mockResolvedValue(null)
    const req = createMockRequest({
      method: 'DELETE',
      query: { credentialId: 'credential-alheia' },
    })
    const res = createMockResponse()

    await handler(req, res)

    expect(res.statusCode).toBe(404)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
