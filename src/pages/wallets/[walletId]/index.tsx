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
import { ArrowLeft, Plus, ChevronLeft, ChevronRight, Settings, TrendingDown, TrendingUp, Wallet } from 'lucide-react'

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
  const [entries, setEntries] = useState<any[]>([])
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

  const fetchEntries = useCallback(async () => {
    const res = await fetch(`/api/wallets/${walletId}/entries?month=${monthKey}`)
    if (res.ok) setEntries((await res.json()).entries)
  }, [monthKey, walletId])

  async function deleteEntry(entry: any) {
    if (!confirm(`Excluir a entrada "${entry.description}"?`)) return
    setMutationError('')
    const res = await fetch(`/api/wallets/${walletId}/entries?id=${entry.id}`, { method: 'DELETE' })
    if (res.ok) await fetchEntries()
    else setMutationError('Não foi possível excluir a entrada')
  }

  useEffect(() => {
    if (!walletId || typeof walletId !== 'string' || !session) return
    fetchWallet()
    void fetchEntries()
    void fetchExpenses().catch(() => {
      setMutationError('Não foi possível carregar as contas. Tente novamente.')
    })
  }, [walletId, session, fetchWallet, fetchExpenses, fetchEntries])

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
    const memberIncome = (m: any) =>
      (m.salary || 0) + (m.extraIncomes ?? []).reduce((sum: number, i: any) => sum + i.amount, 0)
    const entriesTotal = entries.reduce((sum, e) => sum + e.amount, 0)
    const total = members.reduce((sum, m) => sum + memberIncome(m), 0) + entriesTotal
    const perMember = members.map((m) => {
      const paid = expenses
        .filter((e) => e.status === 'paid' && e.paidById === m.userId)
        .reduce((sum, e) => sum + e.amount, 0)
      return { id: m.id, name: m.user?.name || m.user?.email || '', salary: memberIncome(m), paid }
    })
    return { total, perMember, entriesTotal }
  }, [wallet, expenses, entries])

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
        </div>

        <div className="mb-2 flex items-center justify-between gap-3">
          <h1 className="min-w-0 break-words text-2xl font-bold">{wallet.name}</h1>
          <Link
            href={`/wallets/${walletId}/settings`}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-dark-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-dark-700 hover:text-white"
          >
            <Settings size={16} /> <span className="hidden min-[400px]:inline">Ajustes da carteira</span><span className="min-[400px]:hidden">Ajustes</span>
          </Link>
        </div>

        {(() => {
          const monthNav = (
            <div className="flex items-center justify-between gap-1 p-3">
              <button onClick={() => changeMonth(-1)} className="shrink-0 rounded-lg p-1 hover:bg-dark-700 min-[400px]:p-1.5" aria-label="Mês anterior">
                <ChevronLeft size={20} />
              </button>
              <span className="text-center text-sm font-semibold capitalize leading-tight">{formatMonthYear(currentDate, locale)}</span>
              <button onClick={() => changeMonth(1)} className="shrink-0 rounded-lg p-1 hover:bg-dark-700 min-[400px]:p-1.5" aria-label="Próximo mês">
                <ChevronRight size={20} />
              </button>
            </div>
          )
          const separate = wallet.salaryMode === 'separate' && income.perMember.length > 1
          const balance = income.total - totals.total
          const positive = balance >= 0

          if (income.total > 0 && !separate) {
            const shadow = '[text-shadow:0_1px_3px_rgba(0,0,0,0.75)]'
            return (
              <div className="relative mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-0.5 overflow-hidden rounded-xl bg-dark-800 px-1.5 py-3 text-[11px] font-medium text-slate-200 min-[400px]:gap-1 min-[400px]:px-2 min-[400px]:text-xs">
                <div
                  className={`pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l ${
                    positive ? 'from-blue-500/50 via-blue-500/20' : 'from-red-500/50 via-red-500/20'
                  } to-transparent`}
                />
                <div className="relative flex items-center gap-1">
                  <button onClick={() => changeMonth(-1)} className="shrink-0 rounded-lg p-1 hover:bg-dark-700 min-[400px]:p-1.5" aria-label="Mês anterior">
                    <ChevronLeft size={20} />
                  </button>
                  <div className="min-w-0 whitespace-nowrap">
                    <p>{t(locale, 'incomeShort')}</p>
                    <p className="mt-0.5 text-[13px] font-bold text-white min-[400px]:text-sm">{formatCurrency(income.total, currency, locale)}</p>
                  </div>
                </div>
                <span className="relative flex flex-col items-center px-0.5 text-center font-semibold leading-tight text-white min-[400px]:px-1">
                  <span className="text-xs capitalize min-[400px]:text-sm">
                    {new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(currentDate)}
                  </span>
                  <span className="text-xs text-slate-300 min-[400px]:text-sm">
                    {new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone: 'UTC' }).format(currentDate)}
                  </span>
                </span>
                <div className="relative flex items-center justify-end gap-1 text-right">
                  <div className="min-w-0 whitespace-nowrap">
                    <p className={shadow}>{t(locale, 'balanceShort')}</p>
                    <p className={`mt-0.5 text-[13px] font-bold min-[400px]:text-sm ${shadow} ${positive ? 'text-blue-200' : 'text-red-300'}`}>
                      {formatCurrency(balance, currency, locale)}
                    </p>
                  </div>
                  <button onClick={() => changeMonth(1)} className="shrink-0 rounded-lg p-1 hover:bg-dark-700 min-[400px]:p-1.5" aria-label="Próximo mês">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div className="mb-4 overflow-hidden rounded-xl bg-dark-800">
              {monthNav}
              {income.total > 0 && (
                <div className="space-y-3 border-t border-slate-700/60 p-4">
                  {income.entriesTotal > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Entradas avulsas do mês</span>
                      <span className="font-semibold text-blue-300">+{formatCurrency(income.entriesTotal, currency, locale)}</span>
                    </div>
                  )}
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
              )}
            </div>
          )
        })()}

        {mutationError && <p className="mb-4 rounded-lg bg-red-500/15 p-3 text-sm text-red-300">{mutationError}</p>}

        <div className="mb-4 space-y-2">
          <Card className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium uppercase tracking-wide text-slate-400">{t(locale, 'totalExpenses')}</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(totals.total, currency, locale)}</p>
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

        <div className="mb-4 mt-5 grid grid-cols-2 justify-items-center gap-2.5">
          <Link
            href={`/wallets/${walletId}/entries/new?month=${monthKey}`}
            className="relative flex w-full max-w-[112px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-blue-600 to-blue-500 min-h-[48px] px-4 py-1.5 text-center text-sm font-bold leading-tight text-white shadow-lg shadow-blue-900/40 transition active:scale-95 hover:brightness-110"
          >
            <TrendingUp aria-hidden size={68} strokeWidth={2.5} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20" />
            <span className="relative [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">Nova<br />entrada</span>
          </Link>
          <Link
            href={`/wallets/${walletId}/expenses/new`}
            className="relative flex w-full max-w-[112px] items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-rose-600 to-red-500 min-h-[48px] px-4 py-1.5 text-center text-sm font-bold leading-tight text-white shadow-lg shadow-red-900/40 transition active:scale-95 hover:brightness-110"
          >
            <TrendingDown aria-hidden size={68} strokeWidth={2.5} className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/20" />
            <span className="relative [text-shadow:0_1px_4px_rgba(0,0,0,0.55)]">Nova<br />despesa</span>
          </Link>
        </div>

        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <TrendingDown size={18} className="text-red-300" /> Despesas do mês
        </h2>

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
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                  <p className="break-words font-medium leading-tight">{expense.description}</p>
                  <p className="whitespace-nowrap text-right font-semibold">{formatCurrency(expense.amount, currency, locale)}</p>
                  <p className="col-span-2 truncate text-sm text-slate-400">
                    {formatDate(expense.dueDate, locale)} · {expense.category?.name || 'Sem categoria'}
                    {expense.series?.type === 'installment' && expense.installmentNumber !== null && (
                      <span> · {expense.installmentNumber}/{expense.series.totalInstallments}</span>
                    )}
                  </p>
                  {expense.status === 'paid' ? (
                    <p className="truncate text-xs text-primary-400">{paidLabel(expense, locale)}</p>
                  ) : (
                    <p className={cn('text-xs font-medium', expense.status === 'overdue' ? 'text-red-300' : 'text-yellow-300')}>
                      {t(locale, expense.status === 'overdue' ? 'statusOverdue' : 'statusOpen')}
                    </p>
                  )}
                  <button
                    disabled={payingExpenseIds.has(expense.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (expense.status !== 'paid' || confirm(t(locale, 'undoPaymentConfirm'))) togglePay(expense)
                    }}
                    className="whitespace-nowrap rounded px-1 text-right text-xs text-slate-300 underline transition-colors hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {payingExpenseIds.has(expense.id)
                      ? 'Atualizando...'
                      : t(locale, expense.status === 'paid' ? 'undoPayment' : 'markAsPaid')}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <h2 className="mb-3 mt-8 flex items-center gap-2 text-lg font-semibold">
          <TrendingUp size={18} className="text-blue-300" /> Entradas do mês
        </h2>

        {entries.length === 0 ? (
          <p className="text-slate-400">Nenhuma entrada neste mês.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <Card key={entry.id} className="border-blue-500/60 bg-blue-500/20">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{entry.description}</p>
                    <p className="text-sm text-slate-400">{formatDate(entry.receivedAt, locale)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-300">+{formatCurrency(entry.amount, currency, locale)}</p>
                    <button
                      onClick={() => deleteEntry(entry)}
                      className="rounded px-1 text-xs text-slate-300 underline transition-colors hover:bg-white/10 hover:text-white"
                    >
                      Excluir
                    </button>
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
