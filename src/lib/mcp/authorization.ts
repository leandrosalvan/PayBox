import { prisma } from '@/lib/prisma'
import { McpHttpError } from '@/lib/mcp/errors'

export type WalletRole = 'owner' | 'member'
export type WalletCapability = 'read' | 'write:expenses' | 'write:categories' | 'admin:wallets' | 'admin:members'

const OWNER_CAPABILITIES = new Set<WalletCapability>([
  'read',
  'write:expenses',
  'write:categories',
  'admin:wallets',
  'admin:members',
])
const MEMBER_CAPABILITIES = new Set<WalletCapability>(['read', 'write:expenses', 'write:categories'])

export async function requireWalletCapability(
  userId: string,
  walletId: string,
  capability: WalletCapability
) {
  const membership = await prisma.walletMember.findUnique({
    where: { walletId_userId: { walletId, userId } },
    select: { id: true, walletId: true, userId: true, role: true },
  })
  if (!membership) {
    throw new McpHttpError(404, 'NOT_FOUND', 'Carteira não encontrada')
  }

  const role: WalletRole = membership.role === 'owner' ? 'owner' : 'member'
  const allowed = role === 'owner' ? OWNER_CAPABILITIES : MEMBER_CAPABILITIES
  if (!allowed.has(capability)) {
    throw new McpHttpError(403, 'FORBIDDEN', 'Ação não permitida')
  }
  return { ...membership, role }
}

export async function assertOwnerCanBeRemoved(walletId: string, memberId: string) {
  const member = await prisma.walletMember.findFirst({
    where: { id: memberId, walletId },
    select: { id: true, role: true },
  })
  if (!member) throw new McpHttpError(404, 'NOT_FOUND', 'Membro não encontrado')
  if (member.role !== 'owner') return member

  const ownerCount = await prisma.walletMember.count({ where: { walletId, role: 'owner' } })
  if (ownerCount <= 1) {
    throw new McpHttpError(409, 'CONFLICT', 'A carteira precisa manter ao menos um proprietário')
  }
  return member
}
