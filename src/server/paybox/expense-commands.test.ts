import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  walletFindUnique: vi.fn(),
  membershipFindUnique: vi.fn(),
  updateMany: vi.fn(),
  expenseFindFirst: vi.fn(),
}))

const tx = {
  walletMember: { findUnique: mocks.membershipFindUnique },
  expense: { updateMany: mocks.updateMany, findFirst: mocks.expenseFindFirst },
}

vi.mock('@/lib/mcp/authorization', () => ({ requireWalletCapability: vi.fn().mockResolvedValue({ role: 'member' }) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    wallet: { findUnique: mocks.walletFindUnique },
    $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
  },
}))

import { setExpensePaymentCommand } from '@/server/paybox/expense-commands'

describe('comando explícito de pagamento', () => {
  beforeEach(() => {
    mocks.walletFindUnique.mockResolvedValue({ currency: 'BRL' })
    mocks.membershipFindUnique.mockResolvedValue({ id: 'membership-1' })
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.expenseFindFirst.mockResolvedValue({
      id: 'expense-1', walletId: 'wallet-1', seriesId: null, description: 'Conta', amount: 1000,
      dueDate: new Date('2026-08-20T00:00:00.000Z'), paidAt: new Date('2026-08-17T03:00:00.000Z'),
      paidById: 'user-1', status: 'paid', installmentNumber: null, categoryId: null,
      createdAt: new Date('2026-08-01T00:00:00.000Z'), updatedAt: new Date('2026-08-17T03:00:00.000Z'),
      category: null, paidBy: { id: 'user-1', name: 'Leandro' }, series: null,
    })
  })

  it('marcar como pago sempre grava paid, nunca alterna', async () => {
    const input = {
      walletId: 'wallet-1', expenseId: 'expense-1', status: 'paid' as const,
      expectedUpdatedAt: '2026-08-17T03:00:00.000Z',
    }
    await setExpensePaymentCommand('user-1', input)
    await setExpensePaymentCommand('user-1', input)
    expect(mocks.updateMany).toHaveBeenCalledTimes(2)
    for (const [call] of mocks.updateMany.mock.calls) {
      expect(call.data.status).toBe('paid')
    }
  })
})
