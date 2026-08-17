export function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`
}

export function toCivilDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

export function toIsoInstant(value: Date | null) {
  return value?.toISOString() ?? null
}

export function effectiveExpenseStatus(
  status: string,
  dueDate: Date,
  now = new Date()
): 'paid' | 'pending' | 'overdue' {
  if (status === 'paid') return 'paid'
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  return dueDate.getTime() < today.getTime() ? 'overdue' : 'pending'
}

export function serializeExpense(
  expense: {
    id: string
    walletId: string
    seriesId: string | null
    description: string
    amount: number
    dueDate: Date
    paidAt: Date | null
    paidById: string | null
    status: string
    installmentNumber: number | null
    categoryId: string | null
    createdAt: Date
    updatedAt: Date
    category?: { id: string; name: string; color: string; icon: string } | null
    paidBy?: { id: string; name: string | null } | null
    series?: { id: string; type: string; totalInstallments: number | null } | null
  },
  currency: string,
  now = new Date()
) {
  return {
    id: expense.id,
    walletId: expense.walletId,
    seriesId: expense.seriesId,
    description: expense.description,
    amountInCents: expense.amount,
    currency,
    dueDate: toCivilDate(expense.dueDate),
    status: effectiveExpenseStatus(expense.status, expense.dueDate, now),
    paidAt: toIsoInstant(expense.paidAt),
    paidBy: expense.paidBy ? { id: expense.paidBy.id, name: expense.paidBy.name } : null,
    category: expense.category ?? null,
    installmentNumber: expense.installmentNumber,
    series: expense.series ?? null,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  }
}
