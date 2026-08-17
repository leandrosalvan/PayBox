import { prisma } from '@/lib/prisma'
import { McpHttpError } from '@/lib/mcp/errors'
import { hashMcpInput } from '@/lib/mcp/hash'

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

type IdempotentResult<T> = { statusCode: number; data: T; replayed: boolean }

export async function runIdempotentMutation<T>(options: {
  key: string
  userId: string
  tool: string
  input: unknown
  execute: () => Promise<{ statusCode: number; data: T }>
}): Promise<IdempotentResult<T>> {
  if (!/^[a-zA-Z0-9._:-]{8,200}$/.test(options.key)) {
    throw new McpHttpError(400, 'VALIDATION_ERROR', 'Idempotency-Key inválida')
  }

  const inputHash = hashMcpInput(options.input)
  const existing = await prisma.mcpIdempotencyRecord.findUnique({
    where: { userId_tool_key: { userId: options.userId, tool: options.tool, key: options.key } },
  })
  let shouldCreate = true
  if (existing) {
    if (existing.inputHash !== inputHash) {
      throw new McpHttpError(409, 'CONFLICT', 'Idempotency-Key usada com dados diferentes')
    }
    if (existing.state === 'completed' && existing.responseText && existing.statusCode) {
      return {
        statusCode: existing.statusCode,
        data: JSON.parse(existing.responseText) as T,
        replayed: true,
      }
    }
    if (existing.state !== 'failed') {
      throw new McpHttpError(409, 'CONFLICT', 'Mutação idempotente ainda em processamento')
    }
    await prisma.mcpIdempotencyRecord.update({
      where: { userId_tool_key: { userId: options.userId, tool: options.tool, key: options.key } },
      data: { state: 'pending', statusCode: null, responseText: null },
    })
    shouldCreate = false
  }

  if (shouldCreate) {
    await prisma.mcpIdempotencyRecord.create({
      data: {
        key: options.key,
        userId: options.userId,
        tool: options.tool,
        inputHash,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      },
    })
  }

  try {
    const result = await options.execute()
    await prisma.mcpIdempotencyRecord.update({
      where: { userId_tool_key: { userId: options.userId, tool: options.tool, key: options.key } },
      data: {
        state: 'completed',
        statusCode: result.statusCode,
        responseText: JSON.stringify(result.data),
      },
    })
    return { ...result, replayed: false }
  } catch (error) {
    await prisma.mcpIdempotencyRecord.update({
      where: { userId_tool_key: { userId: options.userId, tool: options.tool, key: options.key } },
      data: { state: 'failed' },
    })
    throw error
  }
}
