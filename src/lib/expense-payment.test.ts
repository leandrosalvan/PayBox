import { describe, expect, it, vi } from 'vitest'
import { setExpensePaymentWithConflictRetry } from './expense-payment'

const expense = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

describe('setExpensePaymentWithConflictRetry', () => {
  it('returns the first successful payment response', async () => {
    const fetcher = vi.fn().mockResolvedValue(expense(200, { status: 'paid' }))

    const response = await setExpensePaymentWithConflictRetry({
      walletId: 'wallet-1',
      expenseId: 'expense-1',
      status: 'paid',
      expectedUpdatedAt: '2026-09-10T12:00:00.000Z',
      fetcher,
    })

    expect(response.status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('reloads the current version and retries once after a conflict', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(expense(409, { error: 'Conflito' }))
      .mockResolvedValueOnce(expense(200, {
        status: 'pending',
        updatedAt: '2026-09-10T13:00:00.000Z',
      }))
      .mockResolvedValueOnce(expense(200, { status: 'paid' }))

    const response = await setExpensePaymentWithConflictRetry({
      walletId: 'wallet-1',
      expenseId: 'expense-1',
      status: 'paid',
      expectedUpdatedAt: '2026-09-10T12:00:00.000Z',
      fetcher,
    })

    expect(response.status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(JSON.parse(fetcher.mock.calls[2][1].body)).toMatchObject({
      status: 'paid',
      expectedUpdatedAt: '2026-09-10T13:00:00.000Z',
    })
  })

  it('does not write again when the requested status is already current', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(expense(409, { error: 'Conflito' }))
      .mockResolvedValueOnce(expense(200, {
        status: 'paid',
        updatedAt: '2026-09-10T13:00:00.000Z',
      }))

    const response = await setExpensePaymentWithConflictRetry({
      walletId: 'wallet-1',
      expenseId: 'expense-1',
      status: 'paid',
      expectedUpdatedAt: '2026-09-10T12:00:00.000Z',
      fetcher,
    })

    expect(response.status).toBe(200)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
