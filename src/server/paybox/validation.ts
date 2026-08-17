import type { Prisma } from '@prisma/client'
import { McpHttpError } from '@/lib/mcp/errors'

export async function assertCategoryInWallet(
  tx: Prisma.TransactionClient,
  walletId: string,
  categoryId: string | null | undefined
) {
  if (!categoryId) return
  const category = await tx.category.findFirst({ where: { id: categoryId, walletId }, select: { id: true } })
  if (!category) throw new McpHttpError(404, 'NOT_FOUND', 'Categoria não encontrada')
}

export async function assertUserInWallet(
  tx: Prisma.TransactionClient,
  walletId: string,
  userId: string | null | undefined
) {
  if (!userId) return
  const member = await tx.walletMember.findUnique({
    where: { walletId_userId: { walletId, userId } },
    select: { id: true },
  })
  if (!member) throw new McpHttpError(404, 'NOT_FOUND', 'Membro não encontrado')
}

export function parseCivilDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new McpHttpError(400, 'VALIDATION_ERROR', 'Data inválida')
  }
  return date
}
