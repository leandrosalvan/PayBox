import { prisma } from '@/lib/prisma'
import { requireWalletCapability } from '@/lib/mcp/authorization'
import { McpHttpError } from '@/lib/mcp/errors'

const DEFAULT_CATEGORIES = [
  { name: 'Alimentação', color: '#10b981', icon: 'utensils' },
  { name: 'Transporte', color: '#3b82f6', icon: 'bus' },
  { name: 'Moradia', color: '#f59e0b', icon: 'home' },
  { name: 'Saúde', color: '#ef4444', icon: 'heart-pulse' },
  { name: 'Lazer', color: '#8b5cf6', icon: 'gamepad-2' },
  { name: 'Educação', color: '#06b6d4', icon: 'graduation-cap' },
  { name: 'Outros', color: '#64748b', icon: 'more-horizontal' },
]

export async function createWalletCommand(userId: string, input: {
  name: string; locale: string; currency: string; salaryMode: string
}) {
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.create({
      data: {
        ...input,
        members: { create: { userId, salary: 0, role: 'owner' } },
      },
      select: { id: true, name: true, locale: true, currency: true, salaryMode: true, createdAt: true, updatedAt: true },
    })
    await tx.category.createMany({ data: DEFAULT_CATEGORIES.map((category) => ({ ...category, walletId: wallet.id })) })
    return { ...wallet, createdAt: wallet.createdAt.toISOString(), updatedAt: wallet.updatedAt.toISOString() }
  })
}

export async function updateWalletCommand(userId: string, input: {
  walletId: string
  changes: { name?: string; locale?: string; currency?: string; salaryMode?: string }
  expectedUpdatedAt: string
}) {
  await requireWalletCapability(userId, input.walletId, 'admin:wallets')
  const changed = await prisma.wallet.updateMany({
    where: { id: input.walletId, updatedAt: new Date(input.expectedUpdatedAt) },
    data: input.changes,
  })
  if (changed.count !== 1) throw new McpHttpError(409, 'CONFLICT', 'Carteira alterada por outra operação')
  const wallet = await prisma.wallet.findUnique({
    where: { id: input.walletId },
    select: { id: true, name: true, locale: true, currency: true, salaryMode: true, createdAt: true, updatedAt: true },
  })
  if (!wallet) throw new McpHttpError(404, 'NOT_FOUND', 'Carteira não encontrada')
  return { ...wallet, createdAt: wallet.createdAt.toISOString(), updatedAt: wallet.updatedAt.toISOString() }
}
