import { useEffect, useState, useMemo } from 'react'
import { getSession, useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { GetServerSideProps } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { formatCurrency, formatDate, formatMonthYear, t, SupportedLocale, SupportedCurrency } from '@/lib/locales'
import { cn } from '@/lib/utils'
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
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthKey = useMemo(() => {
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  }, [currentDate])

  useEffect(() => {
    if (!walletId || typeof walletId !== 'string' || !session) return
    fetchWallet()
    fetchExpenses()
  }, [walletId, session, monthKey])

  async function fetchWallet() {
    const res = await fetch(`/api/wallets/${walletId}`)
    if (res.ok) setWallet(await res.json())
  }

  async function fetchExpenses() {
    setLoading(true)
    const res = await fetch(`/api/wallets/${walletId}/expenses?month=${monthKey}`)
    if (res.ok) {
      const data = await res.json()
      setExpenses(data.expenses)
    }
    setLoading(false)
  }

  async function togglePay(expenseId: string) {
    const res = await fetch(`/api/wallets/${walletId}/expenses/${expenseId}/pay`, { method: 'POST' })
    if (res.ok) fetchExpenses()
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
          <Link href="/wallets" className="flex items-center text-slate-400 hover:text-white">
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

        <div className="mb-4 grid grid-cols-3 gap-2">
          <Card className="text-center">
            <p className="text-xs text-slate-400">{t(locale, 'totalPaid')}</p>
            <p className="font-semibold text-primary-400">{formatCurrency(totals.paid, currency, locale)}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-slate-400">{t(locale, 'totalPending')}</p>
            <p className="font-semibold text-slate-300">{formatCurrency(totals.pending, currency, locale)}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-slate-400">{t(locale, 'totalOverdue')}</p>
            <p className="font-semibold text-red-400">{formatCurrency(totals.overdue, currency, locale)}</p>
          </Card>
        </div>

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
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePay(expense.id)
                      }}
                      className={`text-xs ${expense.status === 'paid' ? 'text-primary-400' : 'text-slate-400'}`}
                    >
                      {expense.status === 'paid' ? t(locale, 'paid') : t(locale, 'pending')}
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
