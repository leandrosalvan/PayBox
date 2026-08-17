import { prisma } from '@/lib/prisma'
import { assertOwnerCanBeRemoved, requireWalletCapability } from '@/lib/mcp/authorization'
import { createMcpConfirmation, runWithMcpConfirmation } from '@/lib/mcp/confirmation'
import { McpHttpError } from '@/lib/mcp/errors'
import type { z } from 'zod'
import type { destructiveActionSchema, destructiveTargetSchema } from '@/lib/mcp/mutation-schemas'

export type DestructiveAction = z.infer<typeof destructiveActionSchema>
export type DestructiveTarget = z.infer<typeof destructiveTargetSchema>

function targetId(action: DestructiveAction, target: DestructiveTarget) {
  if (action.includes('expense') || action === 'stop_recurring_expense') return target.expenseId
  if (action === 'delete_category') return target.categoryId
  if (action === 'remove_wallet_member') return target.memberId
  return target.walletId
}

async function authorize(userId: string, action: DestructiveAction, target: DestructiveTarget) {
  if (action === 'delete_wallet') return requireWalletCapability(userId, target.walletId, 'admin:wallets')
  if (action === 'remove_wallet_member') return requireWalletCapability(userId, target.walletId, 'admin:members')
  if (action === 'delete_category') return requireWalletCapability(userId, target.walletId, 'write:categories')
  return requireWalletCapability(userId, target.walletId, 'write:expenses')
}

export async function previewDestructiveActionCommand(
  userId: string,
  action: DestructiveAction,
  target: DestructiveTarget
) {
  await authorize(userId, action, target)
  const id = targetId(action, target)
  if (!id) throw new McpHttpError(400, 'VALIDATION_ERROR', 'Alvo inválido para a ação')

  let preview: { description: string; affectedCount: number; consequences: string[]; expectedUpdatedAt?: string }
  if (action === 'delete_wallet') {
    const wallet = await prisma.wallet.findUnique({
      where: { id: target.walletId },
      select: { name: true, updatedAt: true, _count: { select: { members: true, categories: true, series: true, expenses: true } } },
    })
    if (!wallet) throw new McpHttpError(404, 'NOT_FOUND', 'Carteira não encontrada')
    const affectedCount = 1 + wallet._count.members + wallet._count.categories + wallet._count.series + wallet._count.expenses
    preview = {
      description: `Excluir a carteira ${wallet.name}`,
      affectedCount,
      consequences: ['Remove a carteira e todos os dados financeiros associados', 'A ação não pode ser desfeita'],
      expectedUpdatedAt: wallet.updatedAt.toISOString(),
    }
  } else if (action === 'delete_category') {
    const category = await prisma.category.findFirst({
      where: { id: target.categoryId!, walletId: target.walletId },
      select: { name: true, _count: { select: { expenses: true, series: true } } },
    })
    if (!category) throw new McpHttpError(404, 'NOT_FOUND', 'Categoria não encontrada')
    preview = {
      description: `Excluir a categoria ${category.name}`,
      affectedCount: 1 + category._count.expenses + category._count.series,
      consequences: ['As despesas serão preservadas e ficarão sem categoria'],
    }
  } else if (action === 'remove_wallet_member') {
    const member = await assertOwnerCanBeRemoved(target.walletId, target.memberId!)
    preview = {
      description: 'Remover membro da carteira',
      affectedCount: 1,
      consequences: [member.role === 'owner' ? 'Remove um proprietário' : 'Remove o acesso do membro'],
    }
  } else {
    const expense = await prisma.expense.findFirst({
      where: { id: target.expenseId!, walletId: target.walletId },
      select: { id: true, description: true, dueDate: true, seriesId: true, updatedAt: true },
    })
    if (!expense) throw new McpHttpError(404, 'NOT_FOUND', 'Despesa não encontrada')
    let affectedCount = 1
    if (action === 'stop_recurring_expense') {
      if (!expense.seriesId) throw new McpHttpError(409, 'CONFLICT', 'Despesa não é recorrente')
      affectedCount = await prisma.expense.count({ where: { seriesId: expense.seriesId, dueDate: { gt: expense.dueDate } } })
    } else if (action === 'delete_future_expenses') {
      if (!expense.seriesId) throw new McpHttpError(409, 'CONFLICT', 'Despesa não pertence a uma série')
      affectedCount = await prisma.expense.count({ where: { seriesId: expense.seriesId, dueDate: { gte: expense.dueDate } } })
    } else if (action === 'delete_expense_series') {
      if (!expense.seriesId) throw new McpHttpError(409, 'CONFLICT', 'Despesa não pertence a uma série')
      affectedCount = await prisma.expense.count({ where: { seriesId: expense.seriesId } })
    }
    preview = {
      description: `${action}: ${expense.description}`,
      affectedCount,
      consequences: ['Remove registros financeiros', 'A ação não pode ser desfeita'],
      expectedUpdatedAt: expense.updatedAt.toISOString(),
    }
  }

  const confirmation = await createMcpConfirmation({
    userId,
    walletId: target.walletId,
    action,
    target: id,
    input: target,
    preview,
  })
  return { action, target, ...preview, ...confirmation }
}

export async function executeDestructiveActionCommand(options: {
  userId: string
  action: DestructiveAction
  target: DestructiveTarget
  confirmationId: string
}) {
  await authorize(options.userId, options.action, options.target)
  const id = targetId(options.action, options.target)
  if (!id) throw new McpHttpError(400, 'VALIDATION_ERROR', 'Alvo inválido para a ação')
  return runWithMcpConfirmation({
    confirmationId: options.confirmationId,
    userId: options.userId,
    walletId: options.target.walletId,
    action: options.action,
    target: id,
    input: options.target,
  }, async (tx, confirmation) => {
    const preview = JSON.parse(confirmation.previewText) as { expectedUpdatedAt?: string }
    if (options.action === 'delete_wallet') {
      const wallet = await tx.wallet.findUnique({
        where: { id: options.target.walletId },
        select: { updatedAt: true, _count: { select: { members: true, categories: true, series: true, expenses: true } } },
      })
      if (!wallet) throw new McpHttpError(404, 'NOT_FOUND', 'Carteira não encontrada')
      if (preview.expectedUpdatedAt && wallet.updatedAt.toISOString() !== preview.expectedUpdatedAt) {
        throw new McpHttpError(409, 'CONFLICT', 'Carteira alterada após a prévia')
      }
      const affectedCount = 1 + wallet._count.members + wallet._count.categories + wallet._count.series + wallet._count.expenses
      await tx.wallet.delete({ where: { id: options.target.walletId } })
      return { affectedCount, effect: 'Carteira excluída' }
    }
    if (options.action === 'delete_category') {
      const [expenses, series] = await Promise.all([
        tx.expense.count({ where: { walletId: options.target.walletId, categoryId: options.target.categoryId } }),
        tx.expenseSeries.count({ where: { walletId: options.target.walletId, categoryId: options.target.categoryId } }),
      ])
      const deleted = await tx.category.deleteMany({ where: { id: options.target.categoryId, walletId: options.target.walletId } })
      if (deleted.count !== 1) throw new McpHttpError(404, 'NOT_FOUND', 'Categoria não encontrada')
      return { affectedCount: expenses + series + 1, effect: 'Categoria excluída; despesas preservadas sem categoria' }
    }
    if (options.action === 'remove_wallet_member') {
      const member = await tx.walletMember.findFirst({
        where: { id: options.target.memberId, walletId: options.target.walletId },
        select: { id: true, role: true },
      })
      if (!member) throw new McpHttpError(404, 'NOT_FOUND', 'Membro não encontrado')
      if (member.role === 'owner') {
        const ownerCount = await tx.walletMember.count({ where: { walletId: options.target.walletId, role: 'owner' } })
        if (ownerCount <= 1) throw new McpHttpError(409, 'CONFLICT', 'A carteira precisa manter ao menos um proprietário')
      }
      const deleted = await tx.walletMember.deleteMany({ where: { id: options.target.memberId, walletId: options.target.walletId } })
      if (deleted.count !== 1) throw new McpHttpError(404, 'NOT_FOUND', 'Membro não encontrado')
      return { affectedCount: 1, effect: 'Membro removido' }
    }
    const expense = await tx.expense.findFirst({
      where: { id: options.target.expenseId!, walletId: options.target.walletId },
      select: { id: true, dueDate: true, seriesId: true, updatedAt: true },
    })
    if (!expense) throw new McpHttpError(404, 'NOT_FOUND', 'Despesa não encontrada')
    if (preview.expectedUpdatedAt && expense.updatedAt.toISOString() !== preview.expectedUpdatedAt) {
      throw new McpHttpError(409, 'CONFLICT', 'Despesa alterada após a prévia')
    }
    if (options.action === 'delete_expense') {
      await tx.expense.delete({ where: { id: expense.id } })
      return { affectedCount: 1, effect: 'Despesa excluída' }
    }
    if (!expense.seriesId) throw new McpHttpError(409, 'CONFLICT', 'Despesa não pertence a uma série')
    if (options.action === 'delete_expense_series') {
      const affectedCount = await tx.expense.count({ where: { seriesId: expense.seriesId } })
      await tx.expenseSeries.delete({ where: { id: expense.seriesId } })
      return { affectedCount, effect: 'Série excluída' }
    }
    const inclusive = options.action === 'delete_future_expenses'
    const deleted = await tx.expense.deleteMany({
      where: { seriesId: expense.seriesId, dueDate: inclusive ? { gte: expense.dueDate } : { gt: expense.dueDate } },
    })
    const last = await tx.expense.findFirst({ where: { seriesId: expense.seriesId }, orderBy: { dueDate: 'desc' }, select: { dueDate: true } })
    await tx.expenseSeries.update({ where: { id: expense.seriesId }, data: { endDate: last?.dueDate ?? expense.dueDate } })
    return {
      affectedCount: deleted.count,
      effect: options.action === 'stop_recurring_expense' ? 'Recorrência interrompida' : 'Despesas futuras excluídas',
    }
  })
}
