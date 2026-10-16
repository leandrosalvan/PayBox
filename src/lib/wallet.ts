import { prisma } from '@/lib/prisma'

export async function getWalletMember(walletId: string, userId: string) {
  return prisma.walletMember.findUnique({
    where: { walletId_userId: { walletId, userId } },
  })
}

export async function requireWalletMember(walletId: string, userId: string) {
  const member = await getWalletMember(walletId, userId)
  if (!member) throw new Error('Forbidden')
  return member
}

export async function getWalletWithMembers(walletId: string) {
  return prisma.wallet.findUnique({
    where: { id: walletId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          extraIncomes: { orderBy: { createdAt: 'asc' } },
        },
      },
      categories: true,
    },
  })
}

export function serializeWallet(wallet: NonNullable<Awaited<ReturnType<typeof getWalletWithMembers>>>) {
  return {
    ...wallet,
    members: wallet.members.map((m: any) => ({
      ...m,
      salary: m.salary,
      user: m.user,
    })),
  }
}

// Carteira mais recente do usuário: a última criada ou editada, contando também as alterações
// nas despesas dela.
export async function getLatestWalletId(userId: string) {
  const memberships = await prisma.walletMember.findMany({
    where: { userId },
    select: { wallet: { select: { id: true, createdAt: true, updatedAt: true } } },
  })
  if (memberships.length === 0) return null
  if (memberships.length === 1) return memberships[0].wallet.id

  const lastExpenseChange = await prisma.expense.groupBy({
    by: ['walletId'],
    where: { walletId: { in: memberships.map((m) => m.wallet.id) } },
    _max: { updatedAt: true },
  })
  const expenseByWallet = new Map(lastExpenseChange.map((row) => [row.walletId, row._max.updatedAt]))

  let latest = { id: memberships[0].wallet.id, time: 0 }
  for (const { wallet } of memberships) {
    const time = Math.max(
      wallet.createdAt.getTime(),
      wallet.updatedAt.getTime(),
      expenseByWallet.get(wallet.id)?.getTime() ?? 0
    )
    if (time > latest.time) latest = { id: wallet.id, time }
  }
  return latest.id
}
