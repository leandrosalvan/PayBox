import { beforeEach, describe, expect, it, vi } from 'vitest'

const records = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { mcpIdempotencyRecord: records },
}))

import { runIdempotentMutation } from '@/lib/mcp/idempotency'
import { hashMcpInput } from '@/lib/mcp/hash'

describe('idempotência MCP', () => {
  beforeEach(() => {
    records.findUnique.mockResolvedValue(null)
    records.create.mockResolvedValue({})
    records.update.mockResolvedValue({})
  })

  it('executa e persiste a primeira invocação', async () => {
    const execute = vi.fn().mockResolvedValue({ statusCode: 201, data: { id: 'expense-1' } })
    const result = await runIdempotentMutation({
      key: 'idem-12345678',
      userId: 'user-1',
      tool: 'create-expense',
      input: { amount: 100 },
      execute,
    })
    expect(result).toEqual({ statusCode: 201, data: { id: 'expense-1' }, replayed: false })
    expect(execute).toHaveBeenCalledOnce()
  })

  it('devolve o resultado original no replay', async () => {
    records.findUnique.mockResolvedValue({
      inputHash: hashMcpInput({ amount: 100 }),
      state: 'completed',
      statusCode: 201,
      responseText: '{"id":"expense-1"}',
    })
    const execute = vi.fn()
    const result = await runIdempotentMutation({
      key: 'idem-12345678',
      userId: 'user-1',
      tool: 'create-expense',
      input: { amount: 100 },
      execute,
    })
    expect(result.replayed).toBe(true)
    expect(execute).not.toHaveBeenCalled()
  })

  it('recusa a mesma chave com payload diferente', async () => {
    records.findUnique.mockResolvedValue({ inputHash: hashMcpInput({ amount: 200 }) })
    await expect(
      runIdempotentMutation({
        key: 'idem-12345678',
        userId: 'user-1',
        tool: 'create-expense',
        input: { amount: 100 },
        execute: vi.fn(),
      })
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})
