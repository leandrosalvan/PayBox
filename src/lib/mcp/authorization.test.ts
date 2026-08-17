import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    walletMember: prismaMocks,
  },
}))

import { assertOwnerCanBeRemoved, requireWalletCapability } from '@/lib/mcp/authorization'

describe('autorização por capacidade', () => {
  beforeEach(() => {
    prismaMocks.findUnique.mockResolvedValue({
      id: 'membership-1',
      walletId: 'wallet-1',
      userId: 'user-1',
      role: 'member',
    })
  })

  it('permite leitura a membro', async () => {
    await expect(requireWalletCapability('user-1', 'wallet-1', 'read')).resolves.toMatchObject({
      role: 'member',
    })
  })

  it('nega administração a membro', async () => {
    await expect(requireWalletCapability('user-1', 'wallet-1', 'admin:wallets')).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('não revela uma carteira sem associação', async () => {
    prismaMocks.findUnique.mockResolvedValue(null)
    await expect(requireWalletCapability('user-1', 'wallet-2', 'read')).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('protege o último proprietário', async () => {
    prismaMocks.findFirst.mockResolvedValue({ id: 'member-1', role: 'owner' })
    prismaMocks.count.mockResolvedValue(1)
    await expect(assertOwnerCanBeRemoved('wallet-1', 'member-1')).rejects.toMatchObject({
      statusCode: 409,
    })
  })
})
