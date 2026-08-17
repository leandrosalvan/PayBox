import { prisma } from '@/lib/prisma'
import { assertOwnerCanBeRemoved, requireWalletCapability } from '@/lib/mcp/authorization'
import { McpHttpError } from '@/lib/mcp/errors'
import { maskEmail } from '@/server/paybox/serializers'

export async function updateMemberSalaryCommand(userId: string, input: {
  walletId: string; memberId: string; salaryInCents: number
}) {
  await requireWalletCapability(userId, input.walletId, 'admin:members')
  const changed = await prisma.walletMember.updateMany({
    where: { id: input.memberId, walletId: input.walletId },
    data: { salary: input.salaryInCents },
  })
  if (changed.count !== 1) throw new McpHttpError(404, 'NOT_FOUND', 'Membro não encontrado')
  const member = await prisma.walletMember.findUnique({
    where: { id: input.memberId },
    select: { id: true, role: true, salary: true, user: { select: { id: true, name: true, email: true } } },
  })
  return {
    id: member!.id,
    userId: member!.user.id,
    name: member!.user.name,
    maskedEmail: maskEmail(member!.user.email),
    role: member!.role,
    salaryInCents: member!.salary,
  }
}

export async function validateMemberRemoval(userId: string, walletId: string, memberId: string) {
  await requireWalletCapability(userId, walletId, 'admin:members')
  return assertOwnerCanBeRemoved(walletId, memberId)
}
