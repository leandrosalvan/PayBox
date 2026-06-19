import { useEffect, useState } from 'react'
import { getSession, useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { GetServerSideProps } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Card from '@/components/ui/Card'
import { supportedCurrencies, supportedLocales, t, SupportedLocale, SupportedCurrency } from '@/lib/locales'
import { Wallet } from '@prisma/client'
import type { ChangeEvent } from 'react'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}

export default function Wallets() {
  const { data: session } = useSession()
  const router = useRouter()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [invites, setInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [locale, setLocale] = useState<SupportedLocale>('pt-BR')
  const [currency, setCurrency] = useState<SupportedCurrency>('BRL')
  const [salaryMode, setSalaryMode] = useState('joint')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!session) return
    fetchData()
  }, [session])

  async function fetchData() {
    setLoading(true)
    const [walletsRes, invitesRes] = await Promise.all([
      fetch('/api/wallets'),
      fetch('/api/invites'),
    ])
    if (walletsRes.ok) {
      const data = await walletsRes.json()
      setWallets(data.wallets)
    }
    if (invitesRes.ok) {
      const data = await invitesRes.json()
      setInvites(data.invites)
    }
    setLoading(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError('')
    const res = await fetch('/api/wallets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, locale, currency, salaryMode }),
    })
    const data = await res.json()
    if (res.ok) {
      router.push(`/wallets/${data.id}`)
    } else {
      setError(data.error || 'Erro ao criar carteira')
    }
    setCreating(false)
  }

  async function acceptInvite(token: string) {
    const res = await fetch(`/api/invites/${token}`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      router.push(`/wallets/${data.walletId}`)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Carteiras - PayBox">
      <div className="py-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('pt-BR', 'wallets')}</h1>
          <Button variant="ghost" onClick={() => router.push('/api/auth/signout')}>
            Sair
          </Button>
        </div>

        {invites.length > 0 && (
          <div className="mb-6 space-y-2">
            <h2 className="text-lg font-semibold text-primary-400">Convites pendentes</h2>
            {invites.map((invite) => (
              <Card key={invite.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{invite.wallet.name}</p>
                  <p className="text-sm text-slate-400">Você foi convidado</p>
                </div>
                <Button size="sm" onClick={() => acceptInvite(invite.token)}>
                  Aceitar
                </Button>
              </Card>
            ))}
          </div>
        )}

        {wallets.length === 0 ? (
          <p className="mb-4 text-slate-400">{t('pt-BR', 'noWallets')}</p>
        ) : (
          <div className="mb-6 space-y-3">
            {wallets.map((wallet) => (
              <Link key={wallet.id} href={`/wallets/${wallet.id}`}>
                <Card className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-white">{wallet.name}</p>
                    <p className="text-sm text-slate-400">
                      {wallet.locale} · {wallet.currency}
                    </p>
                  </div>
                  <span className="text-2xl text-primary-400">›</span>
                </Card>
              </Link>
            ))}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-slate-700 bg-dark-800 p-4">
          <h2 className="text-lg font-semibold">{t('pt-BR', 'newWallet')}</h2>
          <Input label={t('pt-BR', 'walletName')} value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required />
          <Select label={t('pt-BR', 'language')} options={supportedLocales} value={locale} onChange={(e: ChangeEvent<HTMLSelectElement>) => setLocale(e.target.value as SupportedLocale)} />
          <Select label={t('pt-BR', 'currency')} options={supportedCurrencies} value={currency} onChange={(e: ChangeEvent<HTMLSelectElement>) => setCurrency(e.target.value as SupportedCurrency)} />
          <Select
            label={t('pt-BR', 'salaryMode')}
            options={[
              { value: 'joint', label: t('pt-BR', 'joint') },
              { value: 'separate', label: t('pt-BR', 'separate') },
            ]}
            value={salaryMode}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setSalaryMode(e.target.value)}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" isLoading={creating}>
            {t('pt-BR', 'createWallet')}
          </Button>
        </form>
      </div>
    </AppLayout>
  )
}
