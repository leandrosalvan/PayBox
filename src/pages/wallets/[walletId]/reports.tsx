import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/router'
import { getSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { t, SupportedLocale, SupportedCurrency, formatCurrency, formatMonthYear } from '@/lib/locales'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}

export default function Reports() {
  const router = useRouter()
  const { walletId } = router.query
  const [wallet, setWallet] = useState<any>(null)
  const [report, setReport] = useState<any>(null)
  const [currentDate, setCurrentDate] = useState(new Date())

  const monthKey = useMemo(() => {
    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  }, [currentDate])

  useEffect(() => {
    if (!walletId || typeof walletId !== 'string') return
    fetch(`/api/wallets/${walletId}`).then((r) => r.json()).then(setWallet)
    fetch(`/api/wallets/${walletId}/reports?month=${monthKey}`).then((r) => r.json()).then(setReport)
  }, [walletId, monthKey])

  function changeMonth(offset: number) {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1))
  }

  const locale = (wallet?.locale as SupportedLocale) || 'pt-BR'
  const currency = (wallet?.currency as SupportedCurrency) || 'BRL'

  if (!wallet || !report) {
    return (
      <AppLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={`Relatórios - ${wallet.name}`}>
      <div className="py-4">
        <div className="mb-4">
          <Link href={`/wallets/${walletId}`} className="flex items-center text-slate-400 hover:text-white">
            <ArrowLeft size={20} className="mr-1" /> Voltar
          </Link>
        </div>
        <h1 className="mb-2 text-2xl font-bold">{t(locale, 'reports')}</h1>

        <div className="mb-4 flex items-center justify-between rounded-xl bg-dark-800 p-3">
          <button onClick={() => changeMonth(-1)} className="rounded-lg p-2 hover:bg-dark-700">
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold capitalize">{formatMonthYear(currentDate, locale)}</span>
          <button onClick={() => changeMonth(1)} className="rounded-lg p-2 hover:bg-dark-700">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Card className="text-center">
            <p className="text-xs text-slate-400">{t(locale, 'totalPaid')}</p>
            <p className="font-semibold text-primary-400">{formatCurrency(report.totalPaid, currency, locale)}</p>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-slate-400">Total</p>
            <p className="font-semibold text-white">{formatCurrency(report.total, currency, locale)}</p>
          </Card>
        </div>

        <Card className="mb-4">
          <h2 className="mb-4 text-lg font-semibold">{t(locale, 'byCategory')}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={report.byCategory}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ value }: any) => formatCurrency(value as number, currency, locale)}
                >
                  {report.byCategory.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any) => formatCurrency(value as number, currency, locale)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="mb-4">
          <h2 className="mb-4 text-lg font-semibold">{t(locale, 'monthlyEvolution')}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.evolution}>
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: any) => formatCurrency(value as number, currency, locale)} />
                <Legend />
                <Bar dataKey="paid" stackId="a" fill="#10b981" name={t(locale, 'paid')} />
                <Bar dataKey="pending" stackId="a" fill="#94a3b8" name={t(locale, 'pending')} />
                <Bar dataKey="overdue" stackId="a" fill="#ef4444" name={t(locale, 'overdue')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}
