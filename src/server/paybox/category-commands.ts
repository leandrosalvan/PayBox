import { prisma } from '@/lib/prisma'
import { requireWalletCapability } from '@/lib/mcp/authorization'
import { McpHttpError } from '@/lib/mcp/errors'

export async function createCategoryCommand(userId: string, input: {
  walletId: string; name: string; color: string; icon: string
}) {
  await requireWalletCapability(userId, input.walletId, 'write:categories')
  try {
    const category = await prisma.category.create({
      data: input,
      select: { id: true, walletId: true, name: true, color: true, icon: true, createdAt: true },
    })
    return { ...category, createdAt: category.createdAt.toISOString() }
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      throw new McpHttpError(409, 'CONFLICT', 'Categoria já existe')
    }
    throw error
  }
}

export async function updateCategoryCommand(userId: string, input: {
  walletId: string; categoryId: string; changes: { name?: string; color?: string; icon?: string }
}) {
  await requireWalletCapability(userId, input.walletId, 'write:categories')
  const changed = await prisma.category.updateMany({
    where: { id: input.categoryId, walletId: input.walletId },
    data: input.changes,
  })
  if (changed.count !== 1) throw new McpHttpError(404, 'NOT_FOUND', 'Categoria não encontrada')
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true, walletId: true, name: true, color: true, icon: true, createdAt: true },
  })
  return { ...category!, createdAt: category!.createdAt.toISOString() }
}
