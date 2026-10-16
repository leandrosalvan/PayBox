import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useRouter } from 'next/router'
import { getSession } from 'next-auth/react'
import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { floatToCents } from '@/lib/utils'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}

function today() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function NewIncomeEntry() {
  const router = useRouter()
  const { walletId } = router.query
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [receivedAt, setReceivedAt] = useState(today)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setReceivedAt((current) => {
      const month = typeof router.query.month === 'string' && /^\d{4}-\d{2}$/.test(router.query.month) ? router.query.month : null
      return month && !current.startsWith(month) ? `${month}-01` : current
    })
  }, [router.query.month])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const cents = floatToCents(parseFloat(amount.replace(',', '.')))
    if (!description.trim() || !cents || cents <= 0 || !receivedAt) return setError('Preencha todos os campos')
    setLoading(true)
    setError('')
    const res = await fetch(`/api/wallets/${walletId}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description, amount: cents, receivedAt }),
    })
    if (res.ok) {
      router.push(`/wallets/${walletId}`)
      return
    }
    const data = await res.json().catch(() => ({}))
    setError(data.error || 'Não foi possível salvar a entrada')
    setLoading(false)
  }

  return (
    <AppLayout title="Nova entrada - PayBox">
      <div className="py-4">
        <div className="mb-4">
          <Link href={`/wallets/${walletId}`} className="flex items-center text-slate-400 hover:text-white">
            <ArrowLeft size={20} className="mr-1" /> Voltar
          </Link>
        </div>
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
          <span className="rounded-lg bg-blue-500/20 p-2 text-blue-300"><TrendingUp size={22} /></span> Nova entrada
        </h1>
        <p className="mb-6 text-sm text-slate-400">Dinheiro que entrou de forma esporádica. Ele é somado à renda do mês.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input label="Descrição" value={description} onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)} placeholder="Ex.: Venda, bônus, reembolso" maxLength={200} required />
          <Input label="Valor" type="text" inputMode="decimal" value={amount} onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)} placeholder="0,00" required />
          <Input label="Data de recebimento" type="date" value={receivedAt} onChange={(e: ChangeEvent<HTMLInputElement>) => setReceivedAt(e.target.value)} required />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" isLoading={loading}>Salvar entrada</Button>
        </form>
      </div>
    </AppLayout>
  )
}
