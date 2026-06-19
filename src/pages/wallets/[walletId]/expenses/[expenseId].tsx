import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { ChangeEvent } from 'react'
import { getSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { t, SupportedLocale, SupportedCurrency, formatCurrency, toDateInputValue } from '@/lib/locales'
import { floatToCents } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}

export default function ExpenseDetail() {
  const router = useRouter()
  const { walletId, expenseId } = router.query
  const [wallet, setWallet] = useState<any>(null)
  const [expense, setExpense] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paidById, setPaidById] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [convertInstallments, setConvertInstallments] = useState('2')

  useEffect(() => {
    if (!walletId || !expenseId || typeof walletId !== 'string' || typeof expenseId !== 'string') return
    fetchData()
  }, [walletId, expenseId])

  async function fetchData() {
    const [walletRes, expenseRes] = await Promise.all([
      fetch(`/api/wallets/${walletId}`),
      fetch(`/api/wallets/${walletId}/expenses/${expenseId}`),
    ])
    if (walletRes.ok) {
      const w = await walletRes.json()
      setWallet(w)
      setMembers(w.members)
      setCategories(w.categories)
    }
    if (expenseRes.ok) {
      const e = await expenseRes.json()
      setExpense(e)
      setDescription(e.description)
      setAmount((e.amount / 100).toFixed(2).replace('.', ','))
      setDueDate(toDateInputValue(new Date(e.dueDate)))
      setCategoryId(e.categoryId || '')
      setPaidById(e.paidById || '')
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = floatToCents(parseFloat(amount.replace(',', '.')))
    setLoading(true)
    const res = await fetch(`/api/wallets/${walletId}/expenses/${expenseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, amount: amountCents, dueDate, categoryId, paidById }),
    })
    if (res.ok) {
      router.push(`/wallets/${walletId}`)
    } else {
      const data = await res.json()
      setError(data.error || 'Erro ao salvar')
    }
    setLoading(false)
  }

  async function handlePay() {
    const res = await fetch(`/api/wallets/${walletId}/expenses/${expenseId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ paidById }),
    })
    if (res.ok) fetchData()
  }

  async function handleAction(action: string, body: any = {}) {
    const res = await fetch(`/api/wallets/${walletId}/expenses/${expenseId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    })
    if (res.ok) router.push(`/wallets/${walletId}`)
    else {
      const data = await res.json()
      setError(data.error || 'Erro')
    }
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return
    const res = await fetch(`/api/wallets/${walletId}/expenses/${expenseId}`, { method: 'DELETE' })
    if (res.ok) router.push(`/wallets/${walletId}`)
  }

  if (!expense || !wallet) {
    return (
      <AppLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  const locale = (wallet?.locale as SupportedLocale) || 'pt-BR'
  const currency = (wallet?.currency as SupportedCurrency) || 'BRL'
  const isSeries = !!expense.series

  return (
    <AppLayout title="Despesa - PayBox">
      <div className="py-4">
        <div className="mb-4">
          <Link href={`/wallets/${walletId}`} className="flex items-center text-slate-400 hover:text-white">
            <ArrowLeft size={20} className="mr-1" /> Voltar
          </Link>
        </div>
        <h1 className="mb-2 text-2xl font-bold">{expense.description}</h1>
        <p className={`mb-4 text-sm font-medium ${expense.status === 'paid' ? 'text-primary-400' : expense.status === 'overdue' ? 'text-red-400' : 'text-slate-400'}`}>
          {expense.status === 'paid' ? t(locale, 'paid') : expense.status === 'overdue' ? t(locale, 'overdue') : t(locale, 'pending')} · {formatCurrency(expense.amount, currency, locale)}
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <Input label={t(locale, 'description')} value={description} onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} required />
          <Input label={t(locale, 'amount')} value={amount} onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)} required />
          <Select
            label={t(locale, 'category')}
            options={[{ value: '', label: 'Sem categoria' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            value={categoryId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setCategoryId(e.target.value)}
          />
          <Input type="date" label={t(locale, 'dueDate')} value={dueDate} onChange={(e: ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)} required />
          <Select
            label={t(locale, 'whoPaid')}
            options={members.map((m) => ({ value: m.userId, label: m.user.name || m.user.email }))}
            value={paidById}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setPaidById(e.target.value)}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" isLoading={loading}>
              {t(locale, 'save')}
            </Button>
            <Button type="button" variant={expense.status === 'paid' ? 'secondary' : 'primary'} className="flex-1" onClick={handlePay}>
              {expense.status === 'paid' ? t(locale, 'pending') : t(locale, 'paid')}
            </Button>
          </div>
        </form>

        {isSeries && (
          <div className="mt-6 space-y-2">
            <h2 className="text-lg font-semibold">Ações da série</h2>
            <Button variant="secondary" className="w-full" onClick={() => handleAction('duplicate')}>
              {t(locale, 'duplicate')}
            </Button>
            {expense.series.type === 'fixed' && (
              <Button variant="secondary" className="w-full" onClick={() => handleAction('stop')}>
                {t(locale, 'stopRecurrence')}
              </Button>
            )}
            <div className="flex gap-2">
              <Input
                type="number"
                min={2}
                value={convertInstallments}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setConvertInstallments(e.target.value)}
                className="flex-1"
              />
              <Button variant="secondary" onClick={() => handleAction('convertToInstallments', { installments: Number(convertInstallments) })}>
                {t(locale, 'convertToInstallments')}
              </Button>
            </div>
            <Button variant="danger" className="w-full" onClick={() => handleAction('deleteFuture')}>
              {t(locale, 'deleteThisAndFuture')}
            </Button>
            <Button variant="danger" className="w-full" onClick={() => handleAction('deleteAll')}>
              {t(locale, 'deleteAll')}
            </Button>
          </div>
        )}

        {!isSeries && (
          <div className="mt-6">
            <Button variant="danger" className="w-full" onClick={handleDelete}>
              {t(locale, 'delete')}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
