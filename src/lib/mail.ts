import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
  port: Number(process.env.BREVO_SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER || '',
    pass: process.env.BREVO_SMTP_PASS || '',
  },
})

export async function sendPasswordResetEmail(to: string, token: string) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const resetUrl = `${baseUrl}/reset-password?token=${token}`
  const from = process.env.FROM_EMAIL || 'noreply@paybox.app'

  await transporter.sendMail({
    from: `PayBox <${from}>`,
    to,
    subject: 'Redefinição de senha - PayBox',
    text: `Você solicitou a redefinição de senha.\n\nAcesse o link: ${resetUrl}\n\nEsse link expira em 1 hora.`,
    html: `<p>Você solicitou a redefinição de senha.</p><p><a href="${resetUrl}">Clique aqui para redefinir sua senha</a></p><p>Esse link expira em 1 hora.</p>`,
  })
}
