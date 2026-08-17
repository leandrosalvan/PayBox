import { beforeEach, describe, expect, it, vi } from 'vitest'
import { hashMcpInput } from '@/lib/mcp/hash'
import { useTestClock } from '@/test/clock'

const tx = vi.hoisted(() => ({
  mcpConfirmation: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
  },
}))

import { consumeMcpConfirmation } from '@/lib/mcp/confirmation'

const input = { walletId: 'wallet-1', expenseId: 'expense-1' }

describe('confirmação destrutiva', () => {
  beforeEach(() => {
    useTestClock()
    tx.mcpConfirmation.findUnique.mockResolvedValue({
      id: 'confirm-1',
      userId: 'user-1',
      walletId: 'wallet-1',
      action: 'delete-expense',
      target: 'expense-1',
      inputHash: hashMcpInput(input),
      consumedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    })
    tx.mcpConfirmation.updateMany.mockResolvedValue({ count: 1 })
  })

  const consume = () =>
    consumeMcpConfirmation({
      confirmationId: 'confirm-1',
      userId: 'user-1',
      walletId: 'wallet-1',
      action: 'delete-expense',
      target: 'expense-1',
      input,
    })

  it('consome uma confirmação válida uma única vez', async () => {
    await expect(consume()).resolves.toMatchObject({ id: 'confirm-1' })
    expect(tx.mcpConfirmation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'confirm-1', consumedAt: null } })
    )
  })

  it('recusa confirmação de outro usuário', async () => {
    tx.mcpConfirmation.findUnique.mockResolvedValue({
      ...(await tx.mcpConfirmation.findUnique()),
      userId: 'user-2',
    })
    await expect(consume()).rejects.toMatchObject({ statusCode: 409 })
  })

  it('recusa confirmação expirada', async () => {
    tx.mcpConfirmation.findUnique.mockResolvedValue({
      ...(await tx.mcpConfirmation.findUnique()),
      expiresAt: new Date(Date.now() - 1),
    })
    await expect(consume()).rejects.toMatchObject({ message: 'Confirmação expirada' })
  })

  it('recusa confirmação para payload diferente', async () => {
    tx.mcpConfirmation.findUnique.mockResolvedValue({
      ...(await tx.mcpConfirmation.findUnique()),
      inputHash: hashMcpInput({ ...input, expenseId: 'expense-2' }),
    })
    await expect(consume()).rejects.toMatchObject({ statusCode: 409 })
  })

  it('recusa consumo concorrente', async () => {
    tx.mcpConfirmation.updateMany.mockResolvedValue({ count: 0 })
    await expect(consume()).rejects.toMatchObject({ message: 'Confirmação já utilizada' })
  })
})
