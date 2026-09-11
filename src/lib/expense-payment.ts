type PaymentStatus = 'paid' | 'pending'

type ExpensePaymentOptions = {
  walletId: string
  expenseId: string
  status: PaymentStatus
  expectedUpdatedAt: string
  paidById?: string
  fetcher?: typeof fetch
}

export async function setExpensePaymentWithConflictRetry({
  walletId,
  expenseId,
  status,
  expectedUpdatedAt,
  paidById,
  fetcher = fetch,
}: ExpensePaymentOptions) {
  const endpoint = `/api/wallets/${walletId}/expenses/${expenseId}`

  const submit = (version: string) => fetcher(`${endpoint}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(paidById ? { paidById } : {}),
      status,
      expectedUpdatedAt: version,
    }),
  })

  const firstResponse = await submit(expectedUpdatedAt)
  if (firstResponse.status !== 409) return firstResponse

  const latestResponse = await fetcher(endpoint)
  if (!latestResponse.ok) return firstResponse

  const latestExpense = await latestResponse.json()
  const requestedPaymentIsCurrent = latestExpense.status === status
    && (!paidById || latestExpense.paidById === paidById)
  if (requestedPaymentIsCurrent) return latestResponse
  if (typeof latestExpense.updatedAt !== 'string') return firstResponse

  return submit(latestExpense.updatedAt)
}

export async function expenseMutationError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === 'string' ? data.error : fallback
  } catch {
    return fallback
  }
}
