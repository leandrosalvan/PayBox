import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { ChangeEvent } from 'react'
import { getSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { t, SupportedLocale, SupportedCurrency, formatCurrency } from '@/lib/locales'
import { floatToCents } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}

export default function NewExpense() {
  const router = useRouter()
  const { walletId } = router.query
  const [wallet, setWallet] = useState<any>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split('T')[0])
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
        dueDay: new Date(dueDate + 'T00:00:00').getDate(),
        dueDate,
        categoryId: categoryId || null,
        type,
        totalInstallments: type === 'installment' ? Number(installments) : undefined,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      router.push(`/wallets/${walletId}`)
    } else {
      setError(data.error || 'Erro ao criar despesa')
    }
    setLoading(false)
  }

  const locale = (wallet?.locale as SupportedLocale) || 'pt-BR'
  const currency = (wallet?.currency as SupportedCurrency) || 'BRL'

  return (
    <AppLayout title="Nova despesa - PayBox">
      <div className="py-4">
        <div className="mb-4">
          <Link href={`/wallets/${walletId}`} className="flex items-center text-slate-400 hover:text-white">
            <ArrowLeft size={20} className="mr-1" /> Voltar
          </Link>
        </div>
        <h1 className="mb-6 text-2xl font-bold">{t(locale, 'addExpense')}</h1>
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
