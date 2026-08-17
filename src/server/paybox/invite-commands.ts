import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { requireWalletCapability } from '@/lib/mcp/authorization'
import { McpHttpError } from '@/lib/mcp/errors'

export async function createWalletInviteCommand(userId: string, input: {
  walletId: string; email: string; sendEmail: boolean
}) {
  await requireWalletCapability(userId, input.walletId, 'admin:members')
  const email = input.email.trim().toLowerCase()
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const invite = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({ where: { email }, select: { id: true } })
    if (existingUser) {
      const membership = await tx.walletMember.findUnique({
        where: { walletId_userId: { walletId: input.walletId, userId: existingUser.id } },
        select: { id: true },
      })
      if (membership) throw new McpHttpError(409, 'CONFLICT', 'Usuário já pertence à carteira')
    }
    try {
      return await tx.walletInvite.create({
        data: { walletId: input.walletId, email, token, expiresAt, invitedById: userId },
        select: { id: true, walletId: true, email: true, status: true, expiresAt: true, createdAt: true },
      })
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new McpHttpError(409, 'CONFLICT', 'Convite pendente já existe')
      }
      throw error
    }
  })

  let emailSent = false
  if (input.sendEmail) {
    try {
      const nodemailer = (await import('nodemailer')).default
      const transporter = nodemailer.createTransport({
        host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
        port: Number(process.env.BREVO_SMTP_PORT || 587),
        secure: false,
        auth: { user: process.env.BREVO_SMTP_USER || '', pass: process.env.BREVO_SMTP_PASS || '' },
      })
      const inviteUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/invites/${token}`
      await transporter.sendMail({
        from: `PayBox <${process.env.FROM_EMAIL || 'noreply@paybox.app'}>`,
        to: email,
        subject: 'Convite para participar de uma carteira no PayBox',
        text: `Acesse o link para aceitar o convite: ${inviteUrl}`,
        html: `<p><a href="${inviteUrl}">Aceitar convite no PayBox</a></p>`,
      })
      emailSent = true
    } catch {
      emailSent = false
    }
  }

  return {
    id: invite.id,
    walletId: invite.walletId,
    status: invite.status,
    expiresAt: invite.expiresAt.toISOString(),
    createdAt: invite.createdAt.toISOString(),
    emailSent,
  }
}

export async function acceptInviteCommand(userId: string, email: string, inviteId: string) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.walletInvite.findFirst({
      where: { id: inviteId, email: email.toLowerCase(), status: 'pending', expiresAt: { gt: new Date() } },
      select: { id: true, walletId: true },
    })
    if (!invite) throw new McpHttpError(404, 'NOT_FOUND', 'Convite não encontrado')
    const membership = await tx.walletMember.upsert({
      where: { walletId_userId: { walletId: invite.walletId, userId } },
      create: { walletId: invite.walletId, userId, role: 'member', salary: 0 },
      update: {},
      select: { id: true, walletId: true, role: true, joinedAt: true },
    })
    await tx.walletInvite.update({ where: { id: invite.id }, data: { status: 'accepted' } })
    return { ...membership, joinedAt: membership.joinedAt.toISOString() }
  })
}
