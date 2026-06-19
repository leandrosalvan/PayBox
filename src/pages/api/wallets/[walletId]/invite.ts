import type { NextApiRequest, NextApiResponse } from 'next'
import { randomBytes } from 'crypto'
import { requireAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import { requireWalletMember } from '@/lib/wallet'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await requireAuth(req, res)
  if (!userId) return

  const { walletId } = req.query
  if (typeof walletId !== 'string') return res.status(400).json({ error: 'ID inválido' })

  try {
    await requireWalletMember(walletId, userId)
  } catch {
    return res.status(403).json({ error: 'Acesso negado' })
  }

  if (req.method !== 'POST') return res.status(405).end()

  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'E-mail obrigatório' })

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    const alreadyMember = await prisma.walletMember.findUnique({
      where: { walletId_userId: { walletId, userId: existingUser.id } },
    })
    if (alreadyMember) return res.status(400).json({ error: 'Usuário já é membro da carteira' })
  }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias

  try {
    await prisma.walletInvite.create({
      data: {
        walletId,
        email,
        token,
        expiresAt,
        invitedById: userId,
      },
    })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(400).json({ error: 'Convite já enviado para este e-mail nesta carteira' })
    }
    throw e
  }

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const inviteUrl = `${baseUrl}/invites/${token}`
  const from = process.env.FROM_EMAIL || 'noreply@paybox.app'

  let emailSent = false
  try {
    const transporter = (await import('nodemailer')).default.createTransport({
      host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
      port: Number(process.env.BREVO_SMTP_PORT || 587),
      secure: false,
      auth: {
        user: process.env.BREVO_SMTP_USER || '',
        pass: process.env.BREVO_SMTP_PASS || '',
      },
    })

    await transporter.sendMail({
      from: `PayBox <${from}>`,
      to: email,
      subject: 'Convite para participar de uma carteira no PayBox',
      text: `Você foi convidado para participar de uma carteira no PayBox.\n\nAcesse o link para aceitar: ${inviteUrl}\n\nO link expira em 7 dias.`,
      html: `<p>Você foi convidado para participar de uma carteira no PayBox.</p><p><a href="${inviteUrl}">Clique aqui para aceitar</a></p><p>O link expira em 7 dias.</p>`,
    })
    emailSent = true
  } catch (err) {
    console.error('Erro ao enviar convite por e-mail:', err)
  }

  return res.status(201).json({ message: 'Convite criado', emailSent, inviteUrl, token })
}
