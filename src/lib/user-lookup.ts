import { prisma } from '@/lib/prisma'

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

// Procura o usuário ignorando maiúsculas/minúsculas, para que o login manual e o do Google
// caiam na mesma conta. Se existirem contas duplicadas, vale a de e-mail exatamente igual ao
// informado, depois a de e-mail minúsculo e, por fim, a mais antiga.
export async function findUserByEmail(email: string) {
  const raw = email.trim()
  const normalized = normalizeEmail(email)
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User"
    WHERE lower("email") = ${normalized}
    ORDER BY ("email" = ${raw}) DESC, ("email" = ${normalized}) DESC, "createdAt" ASC
    LIMIT 1
  `
  if (rows.length === 0) return null
  return prisma.user.findUnique({ where: { id: rows[0].id } })
}
