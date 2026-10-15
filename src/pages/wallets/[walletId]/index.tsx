import { useCallback, useEffect, useState, useMemo } from 'react'
import { getSession, useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { GetServerSideProps } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { formatCurrency, formatDate, formatMonthYear, paidLabel, t, SupportedLocale, SupportedCurrency } from '@/lib/locales'
import { cn } from '@/lib/utils'
import { expenseMutationError, setExpensePaymentWithConflictRetry } from '@/lib/expense-payment'
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, Wallet } from 'lucide-react'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}

export default function WalletHome() {
  const router = useRouter()
  const { walletId } = router.query
  const { data: session } = useSession()
  const [wallet, setWallet] = useState<any>(null)
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [payingExpenseIds, setPayingExpenseIds] = useState<Set<string>>(() => new Set())
  const [mutationError, setMutationError] = useState('')
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthKey = useMemo(() => {
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  }, [currentDate])

  const fetchWallet = useCallback(async () => {
    const res = await fetch(`/api/wallets/${walletId}`)
    if (res.ok) setWallet(await res.json())
  }, [walletId])

  const fetchExpenses = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch(`/api/wallets/${walletId}/expenses?month=${monthKey}`)
      if (!res.ok) throw new Error('Não foi possível atualizar a lista de contas.')
      const data = await res.json()
      setExpenses(data.expenses)
    } finally {
      setLoading(false)
    }
  }, [monthKey, walletId])

  useEffect(() => {
    if (!walletId || typeof walletId !== 'string' || !session) return
    fetchWallet()
    void fetchExpenses().catch(() => {
      setMutationError('Não foi possível carregar as contas. Tente novamente.')
    })
  }, [walletId, session, fetchWallet, fetchExpenses])

  async function togglePay(expense: any) {
    setMutationError('')
    setPayingExpenseIds((current) => new Set(current).add(expense.id))
    try {
      const res = await setExpensePaymentWithConflictRetry({
        walletId: String(walletId),
        expenseId: expense.id,
        status: expense.status === 'paid' ? 'pending' : 'paid',
        expectedUpdatedAt: expense.updatedAt,
      })
      if (res.ok) await fetchExpenses({ silent: true })
      else setMutationError(await expenseMutationError(res, 'Não foi possível atualizar a conta'))
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Não foi possível conectar ao servidor. Tente novamente.')
    } finally {
      setPayingExpenseIds((current) => {
        const next = new Set(current)
        next.delete(expense.id)
        return next
      })
    }
  }

  function changeMonth(offset: number) {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
  }

  const locale = (wallet?.locale as SupportedLocale) || 'pt-BR'
  const currency = (wallet?.currency as SupportedCurrency) || 'BRL'

  const totals = useMemo(() => {
    const paid = expenses.filter((e) => e.status === 'paid').reduce((s, e) => s + e.amount, 0)
    const pending = expenses.filter((e) => e.status === 'pending').reduce((s, e) => s + e.amount, 0)
    const overdue = expenses.filter((e) => e.status === 'overdue').reduce((s, e) => s + e.amount, 0)
    return { paid, pending, overdue, total: paid + pending + overdue }
  }, [expenses])

  const income = useMemo(() => {
    const members: any[] = wallet?.members ?? []
    const total = members.reduce((sum, m) => sum + (m.salary || 0), 0)
    const perMember = members.map((m) => {
      const paid = expenses
        .filter((e) => e.status === 'paid' && e.paidById === m.userId)
        .reduce((sum, e) => sum + e.amount, 0)
      return { id: m.id, name: m.user?.name || m.user?.email || '', salary: m.salary || 0, paid }
    })
    return { total, perMember }
  }, [wallet, expenses])

  if (!wallet || loading) {
    return (
      <AppLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={`${wallet.name} - PayBox`}>
      <div className="py-4">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/wallets?all=1" className="flex items-center text-slate-400 hover:text-white">
            <ArrowLeft size={20} className="mr-1" /> {t(locale, 'wallets')}
          </Link>
          <Link href={`/wallets/${walletId}/settings`} className="text-sm text-primary-400 hover:underline">
            {t(locale, 'settings')}
          </Link>
        </div>

        <h1 className="mb-2 text-2xl font-bold">{wallet.name}</h1>

        <div className="mb-4 flex items-center justify-between rounded-xl bg-dark-800 p-3">
          <button onClick={() => changeMonth(-1)} className="rounded-lg p-2 hover:bg-dark-700">
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold capitalize">{formatMonthYear(currentDate, locale)}</span>
          <button onClick={() => changeMonth(1)} className="rounded-lg p-2 hover:bg-dark-700">
            <ChevronRight size={20} />
          </button>
        </div>

        {mutationError && <p className="mb-4 rounded-lg bg-red-500/15 p-3 text-sm text-red-300">{mutationError}</p>}

        <div className="mb-4 space-y-2">
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t(locale, 'totalExpenses')}</p>
            <p className="mt-1 text-2xl font-bold text-white">{formatCurrency(totals.total, currency, locale)}</p>
          </Card>
          <div className="grid grid-cols-3 gap-2">
            <Card className="relative overflow-hidden p-3">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-red-500/50 via-red-500/20 to-red-500/0" />
              <p className="relative text-xs font-medium text-slate-200 [text-shadow:0_1px_3px_rgba(0,0,0,0.75)]">{t(locale, 'totalOverdue')}</p>
              <p className="relative mt-1 text-sm font-semibold text-red-400 [text-shadow:0_1px_3px_rgba(0,0,0,0.75)] sm:text-base">{formatCurrency(totals.overdue, currency, locale)}</p>
            </Card>
            <Card className="relative overflow-hidden p-3">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-yellow-400/50 via-yellow-400/20 to-yellow-400/0" />
              <p className="relative text-xs font-medium text-slate-200 [text-shadow:0_1px_3px_rgba(0,0,0,0.75)]">{t(locale, 'totalPending')}</p>
              <p className="relative mt-1 text-sm font-semibold text-yellow-400 [text-shadow:0_1px_3px_rgba(0,0,0,0.75)] sm:text-base">{formatCurrency(totals.pending, currency, locale)}</p>
            </Card>
            <Card className="relative overflow-hidden p-3">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-green-500/50 via-green-500/20 to-green-500/0" />
              <p className="relative text-xs font-medium text-slate-200 [text-shadow:0_1px_3px_rgba(0,0,0,0.75)]">{t(locale, 'totalPaid')}</p>
              <p className="relative mt-1 text-sm font-semibold text-primary-400 [text-shadow:0_1px_3px_rgba(0,0,0,0.75)] sm:text-base">{formatCurrency(totals.paid, currency, locale)}</p>
            </Card>
          </div>
        </div>

        {income.total > 0 && (
          <Card className="mb-4">
            {wallet.salaryMode === 'separate' && income.perMember.length > 1 ? (
              <div className="space-y-3">
                {income.perMember.map((m) => {
                  const leftover = m.salary - m.paid
                  return (
                    <div key={m.id}>
                      <p className="text-sm font-medium text-white">{m.name}</p>
                      <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-slate-400">
                        <div>
                          <p>{t(locale, 'monthIncome')}</p>
                          <p className="text-sm font-semibold text-white">{formatCurrency(m.salary, currency, locale)}</p>
                        </div>
                        <div>
                          <p>{t(locale, 'paidByMember')}</p>
                          <p className="text-sm font-semibold text-white">{formatCurrency(m.paid, currency, locale)}</p>
                        </div>
                        <div>
                          <p>{t(locale, 'monthLeftover')}</p>
                          <p className={`text-sm font-semibold ${leftover >= 0 ? 'text-primary-400' : 'text-red-400'}`}>{formatCurrency(leftover, currency, locale)}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                <div>
                  <p>{t(locale, 'monthIncome')}</p>
                  <p className="text-base font-semibold text-white">{formatCurrency(income.total, currency, locale)}</p>
                </div>
                <div>
                  <p>{t(locale, 'monthLeftover')}</p>
                  <p className={`text-base font-semibold ${income.total - totals.total >= 0 ? 'text-primary-400' : 'text-red-400'}`}>
                    {formatCurrency(income.total - totals.total, currency, locale)}
                  </p>
                </div>
              </div>
            )}
          </Card>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t(locale, 'addExpense')}</h2>
          <Link href={`/wallets/${walletId}/expenses/new`}>
            <Button size="sm" className="px-3">
              <Plus size={18} />
            </Button>
          </Link>
        </div>

        {expenses.length === 0 ? (
          <p className="text-slate-400">{t(locale, 'noExpenses')}</p>
        ) : (
          <div className="space-y-2">
            {expenses.map((expense) => (
              <Card
                key={expense.id}
                onClick={() => router.push(`/wallets/${walletId}/expenses/${expense.id}`)}
                className={cn(
                  expense.status === 'paid' && 'border-green-500 bg-green-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]',
                  expense.status === 'overdue' && 'border-red-500 bg-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{expense.description}</p>
                    <p className="text-sm text-slate-400">
                      {formatDate(expense.dueDate, locale)} · {expense.category?.name || 'Sem categoria'}
                      {expense.series?.type === 'installment' && expense.installmentNumber !== null && (
                        <span> · {expense.installmentNumber}/{expense.series.totalInstallments}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(expense.amount, currency, locale)}</p>
                    {expense.status === 'paid' ? (
                      <>
                        <p className="text-xs text-primary-400">
                          {paidLabel(expense, locale)}
                        </p>
                        <button
                          disabled={payingExpenseIds.has(expense.id)}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(t(locale, 'undoPaymentConfirm'))) togglePay(expense)
                          }}
                          className="rounded px-1 text-xs text-slate-300 underline transition-colors hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60"
                        >
                          {payingExpenseIds.has(expense.id) ? 'Atualizando...' : t(locale, 'undoPayment')}
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={payingExpenseIds.has(expense.id)}
                        onClick={(e) => {
                          e.stopPropagation()
                          togglePay(expense)
                        }}
                        className="rounded px-1 text-xs text-slate-300 underline transition-colors hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60"
                      >
                        {payingExpenseIds.has(expense.id) ? 'Atualizando...' : t(locale, 'markAsPaid')}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Link href={`/wallets/${walletId}/reports`} className="flex-1">
            <Button variant="secondary" className="w-full">
              <Wallet size={16} className="mr-2" /> {t(locale, 'reports')}
            </Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
