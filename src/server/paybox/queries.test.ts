import { describe, expect, it, vi } from 'vitest'
import { useTestClock } from '@/test/clock'

const prismaMocks = vi.hoisted(() => ({
  walletFindUnique: vi.fn(),
  expenseFindMany: vi.fn(),
  expenseUpdateMany: vi.fn(),
}))

vi.mock('@/lib/mcp/authorization', () => ({ requireWalletCapability: vi.fn().mockResolvedValue({ role: 'member' }) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    wallet: { findUnique: prismaMocks.walletFindUnique },
    expense: { findMany: prismaMocks.expenseFindMany, updateMany: prismaMocks.expenseUpdateMany },
  },
}))

import { getMonthSummary } from '@/server/paybox/queries'

describe('consultas financeiras puras', () => {
  it('calcula vencido sem executar escrita', async () => {
    useTestClock(new Date('2026-08-17T03:00:00.000Z'))
    prismaMocks.walletFindUnique.mockResolvedValue({ currency: 'BRL' })
    prismaMocks.expenseFindMany.mockResolvedValue([
      { amount: 1500, status: 'pending', dueDate: new Date('2026-08-01T00:00:00.000Z'), category: null },
    ])
    const summary = await getMonthSummary('user-1', 'wallet-1', '2026-08')
    expect(summary.overdueInCents).toBe(1500)
    expect(prismaMocks.expenseUpdateMany).not.toHaveBeenCalled()
  })
})
