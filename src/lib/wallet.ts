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
      members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
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
