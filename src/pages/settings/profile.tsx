import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import { UserRound } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import { supportedCurrencies, supportedLocales } from '@/lib/locales'
import type { SupportedCurrency, SupportedLocale } from '@/lib/locales'
import { setPreferences } from '@/lib/use-preferences'
import IntegrationsPanel from '@/components/settings/IntegrationsPanel'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [hasPassword, setHasPassword] = useState(true)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [locale, setLocale] = useState<SupportedLocale>('pt-BR')
  const [currency, setCurrency] = useState<SupportedCurrency>('BRL')
  const [savingName, setSavingName] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/user/profile')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        setName(data.name ?? '')
        setHasPassword(data.hasPassword)
        setLocale(data.locale)
        setCurrency(data.currency)
      })
      .catch(() => setError('Não foi possível carregar seus dados'))
  }, [])

  async function patch(body: object) {
    setMessage('')
    setError('')
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) setError(data.error || 'Não foi possível salvar')
    return res.ok
  }

  async function saveName(e: FormEvent) {
    e.preventDefault()
    setSavingName(true)
    if (await patch({ name })) setMessage('Nome atualizado')
    setSavingName(false)
  }

  async function savePreferences(next: { locale: SupportedLocale; currency: SupportedCurrency }) {
    setLocale(next.locale)
    setCurrency(next.currency)
    if (await patch(next)) {
      setPreferences(next)
      setMessage('Preferências atualizadas')
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) return setError('A confirmação não confere com a nova senha')
    setSavingPassword(true)
    if (await patch({ currentPassword, newPassword })) {
      setMessage('Senha atualizada')
      setHasPassword(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  const bind = (set: (value: string) => void) => (e: ChangeEvent<HTMLInputElement>) => set(e.target.value)

  return (
    <AppLayout title="PayBox - Meu perfil" backHref="/wallets" backLabel="Voltar para carteiras">
      <div className="py-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="hidden rounded-xl bg-primary-500/15 p-3 text-primary-400 sm:block"><UserRound size={24} /></div>
            <h1 className="whitespace-nowrap text-2xl font-bold">Meu perfil</h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <select
              aria-label="Idioma padrão das novas carteiras"
              value={locale}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => savePreferences({ locale: e.target.value as SupportedLocale, currency })}
              className="rounded-md border border-slate-700 bg-transparent px-2 py-1 text-xs text-slate-300 focus:border-primary-500 focus:outline-none"
            >
              {supportedLocales.map((o) => <option key={o.value} value={o.value} className="bg-dark-800">{o.label}</option>)}
            </select>
            <select
              aria-label="Moeda padrão das novas carteiras"
              value={currency}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => savePreferences({ locale, currency: e.target.value as SupportedCurrency })}
              className="rounded-md border border-slate-700 bg-transparent px-2 py-1 text-xs text-slate-300 focus:border-primary-500 focus:outline-none"
            >
              {supportedCurrencies.map((o) => <option key={o.value} value={o.value} className="bg-dark-800">{o.label}</option>)}
            </select>
          </div>
        </div>

        {message && <p className="mb-4 rounded-lg bg-primary-500/10 px-3 py-2 text-sm text-primary-300">{message}</p>}
        {error && <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

        <Card className="mb-6">
          <form onSubmit={saveName} className="space-y-4">
            <h2 className="text-lg font-semibold">Dados pessoais</h2>
            <Input label="Nome" value={name} onChange={bind(setName)} required maxLength={80} />
            <Button type="submit" className="w-full" isLoading={savingName}>Salvar</Button>
          </form>
        </Card>

        <Card className="mb-10">
          <form onSubmit={savePassword} className="space-y-4">
            <h2 className="text-lg font-semibold">{hasPassword ? 'Alterar senha' : 'Definir senha'}</h2>
            {hasPassword && (
              <Input label="Senha atual" type="password" autoComplete="current-password" value={currentPassword} onChange={bind(setCurrentPassword)} required />
            )}
            <Input label="Nova senha" type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={bind(setNewPassword)} required />
            <Input label="Confirmar nova senha" type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={bind(setConfirmPassword)} required />
            <Button type="submit" className="w-full" isLoading={savingPassword}>Salvar senha</Button>
          </form>
        </Card>

        <IntegrationsPanel />
      </div>
    </AppLayout>
  )
}
