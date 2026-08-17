import { prisma } from '../src/lib/prisma'

async function main() {
  const wallets = await prisma.wallet.findMany({
    select: {
      id: true,
      members: {
        select: { id: true, role: true, joinedAt: true },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })

  for (const wallet of wallets) {
    if (wallet.members.some((member) => member.role === 'owner')) continue
    const oldestMember = wallet.members[0]
    if (!oldestMember) continue
    await prisma.walletMember.update({
      where: { id: oldestMember.id },
      data: { role: 'owner' },
    })
  }
}

main()
  .catch((error) => {
    console.error('Falha no backfill de proprietários:', error instanceof Error ? error.message : 'erro desconhecido')
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
