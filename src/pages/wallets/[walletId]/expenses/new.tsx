import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { ChangeEvent } from 'react'
import { getSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { t, formatCurrency } from '@/lib/locales'
import { useWalletId } from '@/lib/last-wallet'
import { usePreferences } from '@/lib/use-preferences'
import { floatToCents } from '@/lib/utils'
import { TrendingDown } from 'lucide-react'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}

export default function NewExpense() {
  const { locale } = usePreferences()
  const router = useRouter()
  const walletId = useWalletId()
  const [wallet, setWallet] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [categoryId, setCategoryId] = useState('')
  const [type, setType] = useState('single')
  const [installments, setInstallments] = useState('2')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!walletId || typeof walletId !== 'string') return
    fetch(`/api/wallets/${walletId}`)
      .then((r) => r.json())
      .then((data) => {
        setWallet(data)
        setCategories(data.categories)
      })
  }, [walletId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountCents = floatToCents(parseFloat(amount.replace(',', '.')))
    if (!description || !amountCents || !dueDate) return setError('Preencha todos os campos obrigatórios')

    setLoading(true)
    setError('')

    const res = await fetch(`/api/wallets/${walletId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description,
        amount: amountCents,
        dueDay: Number(dueDate.split('-')[2]),
        dueDate,
        categoryId: categoryId || null,
        type,
        totalInstallments: type === 'installment' ? Number(installments) : undefined,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      router.push(`/wallet`)
    } else {
      setError(data.error || 'Erro ao criar despesa')
    }
    setLoading(false)
  }


  return (
    <AppLayout title="PayBox - Nova despesa" backHref={`/wallet`}>
      <div className="py-4">
        <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold">
          <span className="rounded-lg bg-red-500/20 p-2 text-red-300"><TrendingDown size={22} /></span> {t(locale, 'addExpense')}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label={t(locale, 'description')} value={description} onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} required />
          <Input
            label={t(locale, 'amount')}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
            required
            placeholder="0,00"
          />
          <Select
            label={t(locale, 'category')}
            options={[{ value: '', label: 'Sem categoria' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            value={categoryId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setCategoryId(e.target.value)}
          />
          <Input type="date" label={t(locale, 'dueDate')} value={dueDate} onChange={(e: ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)} required />
          <Select
            label={t(locale, 'recurrence')}
            options={[
              { value: 'single', label: t(locale, 'none') },
              { value: 'fixed', label: t(locale, 'fixed') },
              { value: 'installment', label: t(locale, 'installment') },
            ]}
            value={type}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setType(e.target.value)}
          />
          {type === 'installment' && (
            <Input
              label={t(locale, 'installments')}
              type="number"
              min={2}
value={installments}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setInstallments(e.target.value)}
            />
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" isLoading={loading}>
            {t(locale, 'save')}
          </Button>
        </form>
      </div>
    </AppLayout>
  )
}
