import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockRequest, createMockResponse } from '@/test/next-api'

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  listWallets: vi.fn(),
}))

vi.mock('@/lib/mcp/auth', () => ({ authenticateMcpRequest: mocks.authenticate }))
vi.mock('@/server/paybox/queries', () => ({ listWallets: mocks.listWallets }))

import handler from '@/pages/api/internal/mcp/wallets'

describe('GET /api/internal/mcp/wallets', () => {
  beforeEach(() => {
    mocks.authenticate.mockResolvedValue({ userId: 'user-1', email: 'mcp@example.com', scopes: new Set(['read']) })
    mocks.listWallets.mockResolvedValue([{ id: 'wallet-1' }])
  })

  it('devolve envelope seguro', async () => {
    const req = createMockRequest({ method: 'GET' })
    const res = createMockResponse()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.payload).toMatchObject({ data: [{ id: 'wallet-1' }], requestId: expect.any(String) })
  })

  it('recusa método inválido antes da autenticação', async () => {
    const req = createMockRequest({ method: 'PUT' })
    const res = createMockResponse()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
    expect(mocks.authenticate).not.toHaveBeenCalled()
  })
})
