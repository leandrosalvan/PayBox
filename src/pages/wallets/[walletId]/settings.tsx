import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import type { ChangeEvent } from 'react'
import { getSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import WhatsAppIcon from '@/components/ui/WhatsAppIcon'
import Card from '@/components/ui/Card'
import { t } from '@/lib/locales'
import { useWalletId } from '@/lib/last-wallet'
import { usePreferences } from '@/lib/use-preferences'
import { floatToCents } from '@/lib/utils'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}

function formatSalary(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function SalaryInput({ salary, onCommit }: { salary: number; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(formatSalary(salary))

  useEffect(() => {
    setDraft(formatSalary(salary))
  }, [salary])

  function commit() {
    const parsed = parseFloat(draft.replace(',', '.'))
    if (Number.isNaN(parsed) || parsed < 0) return setDraft(formatSalary(salary))
    if (floatToCents(parsed) !== salary) onCommit(draft)
    else setDraft(formatSalary(salary))
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className="w-28 py-1 text-sm"
    />
  )
}

function IncomeForm({ onAdd }: { onAdd: (description: string, value: string) => Promise<boolean> }) {
  const [description, setDescription] = useState('')
  const [value, setValue] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (await onAdd(description, value)) {
      setDescription('')
      setValue('')
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 flex gap-2">
      <Input
        value={description}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
        placeholder="Ex.: Freelance"
        className="flex-1 py-1 text-sm"
      />
      <Input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
        placeholder="0,00"
        className="w-24 py-1 text-sm"
      />
      <Button type="submit" size="sm">
        +
      </Button>
    </form>
  )
}

export default function WalletSettings() {
  const { locale } = usePreferences()
  const router = useRouter()
  const walletId = useWalletId()
  const [wallet, setWallet] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const savedName = useRef('')

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/wallets/${walletId}`)
    if (res.ok) {
      const data = await res.json()
      setWallet(data)
      savedName.current = data.name
      setMembers(data.members)
      setCategories(data.categories)
    }
  }, [walletId])

  useEffect(() => {
    if (!walletId || typeof walletId !== 'string') return
    fetchData()
  }, [walletId, fetchData])

  async function saveWallet(changes: { name?: string; salaryMode?: string }) {
    setMessage('')
    setError('')
    const res = await fetch(`/api/wallets/${walletId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...changes, expectedUpdatedAt: wallet.updatedAt }),
    })
    if (res.ok) {
      setMessage('Carteira atualizada')
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Erro ao atualizar')
    }
    fetchData()
  }

  async function updateSalary(memberId: string, salary: string) {
    const res = await fetch(`/api/wallets/${walletId}/members`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, salary: floatToCents(parseFloat(salary.replace(',', '.'))) }),
    })
    if (res.ok) fetchData()
  }

  async function addIncome(memberId: string, description: string, value: string) {
    const parsed = parseFloat(value.replace(',', '.'))
    if (!description.trim() || Number.isNaN(parsed) || parsed <= 0) {
      setError('Informe a descrição e um valor maior que zero')
      return false
    }
    setError('')
    const res = await fetch(`/api/wallets/${walletId}/incomes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, description, amount: floatToCents(parsed) }),
    })
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error || 'Não foi possível adicionar a renda')
      return false
    }
    fetchData()
    return true
  }

  async function removeIncome(id: string) {
    if (!confirm('Remover esta renda?')) return
    await fetch(`/api/wallets/${walletId}/incomes?id=${id}`, { method: 'DELETE' })
    fetchData()
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
    if (res.ok) router.push('/wallets?all=1')
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

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : process.env.NEXTAUTH_URL || ''
  const inviteLink = wallet ? `${baseUrl}/join/${wallet.inviteToken}` : ''

  return (
    <AppLayout title="PayBox - Configurações" backHref={`/wallet`}>
      <div className="py-4">
        <h1 className="mb-4 text-2xl font-bold">{t(locale, 'settings')}</h1>

        {message && <p className="mb-4 text-sm text-primary-400">{message}</p>}
        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="mb-4 flex items-center gap-2">
          <input
            aria-label={t(locale, 'walletName')}
            title={t(locale, 'walletName')}
            value={wallet.name}
            maxLength={80}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setWallet({ ...wallet, name: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            onBlur={() => {
              const name = wallet.name.trim()
              if (!name) return fetchData()
              if (name !== savedName.current) saveWallet({ name })
            }}
            className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-dark-800 px-3 py-1.5 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <select
            aria-label={t(locale, 'salaryMode')}
            title={t(locale, 'salaryMode')}
            value={wallet.salaryMode}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => {
              setWallet({ ...wallet, salaryMode: e.target.value })
              saveWallet({ salaryMode: e.target.value })
            }}
            className="rounded-lg border border-slate-600 bg-dark-800 px-2 py-1.5 text-sm text-white focus:border-primary-500 focus:outline-none"
          >
            <option value="joint">{t(locale, 'joint')}</option>
            <option value="separate">{t(locale, 'separate')}</option>
          </select>
        </div>

        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{t(locale, 'members')}</h2>
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Vamos controlar as despesas juntos no PayBox! Entre na carteira: ${inviteLink}`)}`}
              target="_blank"
              rel="noreferrer"
              title="Convidar pelo WhatsApp"
              aria-label="Convidar pelo WhatsApp"
              className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1 text-sm font-medium text-white hover:brightness-95"
            >
              <WhatsAppIcon size={16} /> Convidar
            </a>
          </div>
          <div className="space-y-2">
            {members.map((member) => (
              <Card key={member.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 break-words">
                    <p className="font-medium">{member.user.name || member.user.email}</p>
                    <p className="break-all text-xs text-slate-400">{member.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <SalaryInput
                      salary={member.salary}
                      onCommit={(value) => updateSalary(member.id, value)}
                    />
                    <Button variant="danger" size="sm" onClick={() => removeMember(member.id)}>
                      ×
                    </Button>
                  </div>
                </div>
                <div className="mt-3 border-t border-dark-700 pt-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Outras rendas (mensais)</p>
                  {(member.extraIncomes ?? []).map((income: any) => (
                    <div key={income.id} className="mb-1 flex items-center justify-between text-sm">
                      <span>{income.description}</span>
                      <span className="flex items-center gap-2">
                        {formatSalary(income.amount)}
                        <button onClick={() => removeIncome(income.id)} className="font-bold text-red-400 hover:opacity-80">
                          ×
                        </button>
                      </span>
                    </div>
                  ))}
                  <IncomeForm onAdd={(description, value) => addIncome(member.id, description, value)} />
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
