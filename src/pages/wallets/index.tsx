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
import { formatCurrency, t } from '@/lib/locales'
import { WALLET_BASE, openWallet, setLastWalletId } from '@/lib/last-wallet'
import { usePreferences } from '@/lib/use-preferences'
import type { ChangeEvent } from 'react'
import { Plus } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getLatestWalletId } from '@/lib/wallet'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }

  // Abre direto na carteira mais recente. `?all=1` mostra a lista; convites pendentes também.
  const userId = session.user?.id
  if (userId && context.query.all !== '1') {
    const [walletId, pendingInvites] = await Promise.all([
      getLatestWalletId(userId),
      session.user?.email
        ? prisma.walletInvite.count({
            where: { email: session.user.email, status: 'pending', expiresAt: { gt: new Date() } },
          })
        : Promise.resolve(0),
    ])
    if (walletId && pendingInvites === 0) {
      return { redirect: { destination: `/wallets/${walletId}`, permanent: false } }
    }
  }
  return { props: {} }
}

type WalletItem = {
  id: string
  name: string
  locale: string
  currency: string
  members: { id: string; user: { name: string | null; email: string } }[]
  summary: { paid: number; pending: number; overdue: number; overdueCount: number }
}

export default function Wallets() {
  const { locale, currency } = usePreferences()
  const { data: session } = useSession()
  const router = useRouter()
  const [wallets, setWallets] = useState<WalletItem[]>([])
  const [invites, setInvites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
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
      body: JSON.stringify({ name, salaryMode }),
    })
    const data = await res.json()
    if (res.ok) {
      openWallet(router, data.id)
    } else {
      setError(data.error || 'Erro ao criar carteira')
    }
    setCreating(false)
  }

  async function acceptInvite(token: string) {
    const res = await fetch(`/api/invites/${token}`, { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      openWallet(router, data.walletId)
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
    <AppLayout title="PayBox - Carteiras">
      <div className="py-4">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('pt-BR', 'wallets')}</h1>
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
            {wallets.map((wallet) => {
              const summary = wallet.summary
              const total = summary.paid + summary.pending + summary.overdue
              const percentPaid = total > 0 ? Math.round((summary.paid / total) * 100) : 0
              const walletLocale = locale
              const walletCurrency = currency
              return (
                <Link key={wallet.id} href={WALLET_BASE} onClick={() => setLastWalletId(wallet.id)}>
                  <Card>
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-white">{wallet.name}</p>
                      <div className="flex -space-x-2">
                        {wallet.members.slice(0, 4).map((member) => (
                          <span
                            key={member.id}
                            title={member.user.name || member.user.email}
                            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-dark-800 bg-dark-600 text-xs font-medium uppercase text-slate-200"
                          >
                            {(member.user.name || member.user.email).charAt(0)}
                          </span>
                        ))}
                      </div>
                    </div>
                    {total > 0 ? (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
                          <div>
                            <p>{t(walletLocale, 'totalOverdue')}</p>
                            <p className={`text-sm font-semibold ${summary.overdue > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                              {formatCurrency(summary.overdue, walletCurrency, walletLocale)}
                            </p>
                          </div>
                          <div>
                            <p>{t(walletLocale, 'totalPending')}</p>
                            <p className="text-sm font-semibold text-yellow-400">
                              {formatCurrency(summary.pending, walletCurrency, walletLocale)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-dark-700">
                          <div className="h-full rounded-full bg-green-500" style={{ width: `${percentPaid}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {percentPaid}% {t(walletLocale, 'totalPaid').toLowerCase()} · {formatCurrency(summary.paid, walletCurrency, walletLocale)}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-slate-400">{t(walletLocale, 'noExpenses')}</p>
                    )}
                  </Card>
                </Link>
              )
            })}
          </div>
        )}

        {!showForm && wallets.length > 0 ? (
          <Button variant="secondary" className="w-full" onClick={() => setShowForm(true)}>
            <Plus size={18} className="mr-2" /> {t('pt-BR', 'newWallet')}
          </Button>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4 rounded-xl border border-slate-700 bg-dark-800 p-4">
            <h2 className="text-lg font-semibold">{t('pt-BR', 'newWallet')}</h2>
            <Input label={t('pt-BR', 'walletName')} value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} required autoFocus={wallets.length > 0} />
            <details className="group">
              <summary className="cursor-pointer text-sm text-slate-400 hover:text-white">Mais opções (salários)</summary>
              <div className="mt-3 space-y-4">
                <Select
                  label={t('pt-BR', 'salaryMode')}
                  options={[
                    { value: 'joint', label: t('pt-BR', 'joint') },
                    { value: 'separate', label: t('pt-BR', 'separate') },
                  ]}
                  value={salaryMode}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setSalaryMode(e.target.value)}
                />
              </div>
            </details>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-2">
              {wallets.length > 0 && (
                <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              )}
              <Button type="submit" className="flex-1" isLoading={creating}>
                {t('pt-BR', 'createWallet')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  )
}
