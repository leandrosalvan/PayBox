import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import type { ChangeEvent } from 'react'
import { getSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Card from '@/components/ui/Card'
import { t, SupportedLocale, SupportedCurrency, supportedLocales, supportedCurrencies } from '@/lib/locales'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { floatToCents } from '@/lib/utils'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}

export default function WalletSettings() {
  const router = useRouter()
  const { walletId } = router.query
  const [wallet, setWallet] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!walletId || typeof walletId !== 'string') return
    fetchData()
  }, [walletId])

  async function fetchData() {
    const res = await fetch(`/api/wallets/${walletId}`)
    if (res.ok) {
      const data = await res.json()
      setWallet(data)
      setMembers(data.members)
      setCategories(data.categories)
    }
  }

  async function handleUpdateWallet(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch(`/api/wallets/${walletId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wallet),
    })
    if (res.ok) {
      setMessage('Carteira atualizada')
    } else {
      const data = await res.json()
      setError(data.error || 'Erro ao atualizar')
    }
    setLoading(false)
  }

  async function copyInviteLink() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setMessage('Link copiado para a área de transferência')
    } catch {
      setError('Não foi possível copiar o link')
    }
  }

  async function updateSalary(memberId: string, salary: string) {
    const res = await fetch(`/api/wallets/${walletId}/members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, salary: floatToCents(parseFloat(salary.replace(',', '.'))) }),
    })
    if (res.ok) fetchData()
  }

  async function removeMember(memberId: string) {
    if (!confirm('Remover membro da carteira?')) return
    await fetch(`/api/wallets/${walletId}/members?memberId=${memberId}`, { method: 'DELETE' })
    fetchData()
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/wallets/${walletId}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategory }),
    })
    if (res.ok) {
      setNewCategory('')
      fetchData()
    }
  }

  async function deleteCategory(id: string) {
    if (!confirm('Excluir categoria?')) return
    await fetch(`/api/wallets/${walletId}/categories?id=${id}`, { method: 'DELETE' })
    fetchData()
  }

  async function deleteWallet() {
    if (!confirm('Tem certeza que deseja excluir esta carteira?')) return
    const res = await fetch(`/api/wallets/${walletId}`, { method: 'DELETE' })
    if (res.ok) router.push('/wallets')
  }

  if (!wallet) {
    return (
      <AppLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  const locale = (wallet?.locale as SupportedLocale) || 'pt-BR'
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXTAUTH_URL || ''
  const inviteLink = wallet ? `${baseUrl}/join/${wallet.inviteToken}` : ''

  return (
    <AppLayout title="Configurações - PayBox">
      <div className="py-4">
        <div className="mb-4">
          <Link href={`/wallets/${walletId}`} className="flex items-center text-slate-400 hover:text-white">
            <ArrowLeft size={20} className="mr-1" /> Voltar
          </Link>
        </div>
        <h1 className="mb-6 text-2xl font-bold">{t(locale, 'settings')}</h1>

        {message && <p className="mb-4 text-sm text-primary-400">{message}</p>}
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <form onSubmit={handleUpdateWallet} className="mb-6 space-y-4">
          <h2 className="text-lg font-semibold">Carteira</h2>
          <Input label={t(locale, 'walletName')} value={wallet.name} onChange={(e: ChangeEvent<HTMLInputElement>) => setWallet({ ...wallet, name: e.target.value })} required />
          <Select
            label={t(locale, 'language')}
            options={supportedLocales}
            value={wallet.locale}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setWallet({ ...wallet, locale: e.target.value })}
          />
          <Select
            label={t(locale, 'currency')}
            options={supportedCurrencies}
            value={wallet.currency}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setWallet({ ...wallet, currency: e.target.value })}
          />
          <Select
            label={t(locale, 'salaryMode')}
            options={[
              { value: 'joint', label: t(locale, 'joint') },
              { value: 'separate', label: t(locale, 'separate') },
            ]}
            value={wallet.salaryMode}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setWallet({ ...wallet, salaryMode: e.target.value })}
          />
          <Button type="submit" className="w-full" isLoading={loading}>
            {t(locale, 'save')}
          </Button>
        </form>

        <div className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">{t(locale, 'invite')}</h2>
          <p className="mb-3 text-sm text-slate-400">Cada carteira tem um link próprio. Compartilhe com quem quiser participar.</p>
          <div className="flex gap-3">
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Vamos controlar as despesas juntos no PayBox! Entre na carteira: ${inviteLink}`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
            >
              WhatsApp ↗
            </a>
            <button
              onClick={copyInviteLink}
              className="flex items-center gap-2 rounded-lg bg-dark-700 px-4 py-2 text-slate-300 hover:bg-dark-600"
            >
              📋 Copiar
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">{t(locale, 'members')}</h2>
          <div className="space-y-2">
            {members.map((member) => (
              <Card key={member.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{member.user.name || member.user.email}</p>
                  <p className="text-xs text-slate-400">{member.user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={(member.salary / 100).toFixed(2).replace('.', ',')}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateSalary(member.id, e.target.value)}
                    className="w-28 py-1 text-sm"
                  />
                  <Button variant="danger" size="sm" onClick={() => removeMember(member.id)}>
                    ×
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">Categorias</h2>
          <form onSubmit={addCategory} className="mb-2 flex gap-2">
            <Input value={newCategory} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewCategory(e.target.value)} placeholder="Nova categoria" className="flex-1" />
            <Button type="submit" size="sm">
              +
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <span
                key={cat.id}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm text-white"
                style={{ backgroundColor: cat.color }}
              >
                {cat.name}
                <button onClick={() => deleteCategory(cat.id)} className="font-bold hover:opacity-80">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <Button variant="danger" className="w-full" onClick={deleteWallet}>
          Excluir carteira
        </Button>
      </div>
    </AppLayout>
  )
}
