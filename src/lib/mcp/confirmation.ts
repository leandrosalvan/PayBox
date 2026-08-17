import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { McpHttpError } from '@/lib/mcp/errors'
import { hashMcpInput } from '@/lib/mcp/hash'
import type { Prisma } from '@prisma/client'

const CONFIRMATION_TTL_MS = 5 * 60 * 1000

export async function createMcpConfirmation(options: {
  userId: string
  walletId: string
  action: string
  target: string
  input: unknown
  preview: unknown
}) {
  const id = `confirm_${randomBytes(24).toString('hex')}`
  const expiresAt = new Date(Date.now() + CONFIRMATION_TTL_MS)
  await prisma.mcpConfirmation.create({
    data: {
      id,
      userId: options.userId,
      walletId: options.walletId,
      action: options.action,
      target: options.target,
      inputHash: hashMcpInput(options.input),
      previewText: JSON.stringify(options.preview),
      expiresAt,
    },
  })
  return { confirmationId: id, expiresAt: expiresAt.toISOString() }
}

export async function consumeMcpConfirmation(options: {
  confirmationId: string
  userId: string
  walletId: string
  action: string
  target: string
  input: unknown
}) {
  return prisma.$transaction(async (tx) => {
    const confirmation = await tx.mcpConfirmation.findUnique({
      where: { id: options.confirmationId },
    })
    const matches =
      confirmation &&
      confirmation.userId === options.userId &&
      confirmation.walletId === options.walletId &&
      confirmation.action === options.action &&
      confirmation.target === options.target &&
      confirmation.inputHash === hashMcpInput(options.input)
    if (!matches) throw new McpHttpError(409, 'CONFLICT', 'Confirmação inválida')
    if (confirmation.consumedAt) throw new McpHttpError(409, 'CONFLICT', 'Confirmação já utilizada')
    if (confirmation.expiresAt.getTime() <= Date.now()) {
      throw new McpHttpError(409, 'CONFLICT', 'Confirmação expirada')
    }

    const consumed = await tx.mcpConfirmation.updateMany({
      where: { id: confirmation.id, consumedAt: null },
      data: { consumedAt: new Date() },
    })
    if (consumed.count !== 1) throw new McpHttpError(409, 'CONFLICT', 'Confirmação já utilizada')
    return confirmation
  })
}

export async function runWithMcpConfirmation<T>(
  options: {
    confirmationId: string
    userId: string
    walletId: string
    action: string
    target: string
    input: unknown
  },
  execute: (tx: Prisma.TransactionClient, confirmation: { previewText: string }) => Promise<T>
) {
  return prisma.$transaction(async (tx) => {
    const confirmation = await tx.mcpConfirmation.findUnique({ where: { id: options.confirmationId } })
    const matches =
      confirmation &&
      confirmation.userId === options.userId &&
      confirmation.walletId === options.walletId &&
      confirmation.action === options.action &&
      confirmation.target === options.target &&
      confirmation.inputHash === hashMcpInput(options.input)
    if (!matches) throw new McpHttpError(409, 'CONFLICT', 'Confirmação inválida')
    if (confirmation.consumedAt) throw new McpHttpError(409, 'CONFLICT', 'Confirmação já utilizada')
    if (confirmation.expiresAt.getTime() <= Date.now()) {
      throw new McpHttpError(409, 'CONFLICT', 'Confirmação expirada')
    }
    const consumed = await tx.mcpConfirmation.updateMany({
      where: { id: confirmation.id, consumedAt: null },
      data: { consumedAt: new Date() },
    })
    if (consumed.count !== 1) throw new McpHttpError(409, 'CONFLICT', 'Confirmação já utilizada')
    const result = await execute(tx, confirmation)
    await tx.mcpConfirmation.update({ where: { id: confirmation.id }, data: { executedAt: new Date() } })
    return result
  })
}
