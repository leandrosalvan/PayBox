import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { GetServerSideProps } from 'next'
import { getSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeft, UserRound } from 'lucide-react'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
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
    <AppLayout title="Meu perfil - PayBox">
      <div className="py-4">
        <Link href="/wallets" className="mb-4 inline-flex items-center text-slate-400 hover:text-white">
          <ArrowLeft size={20} className="mr-1" /> Voltar para carteiras
        </Link>

        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-xl bg-primary-500/15 p-3 text-primary-400"><UserRound size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold">Meu perfil</h1>
            <p className="mt-1 text-sm text-slate-400">Dados da sua conta e integrações. As configurações de cada carteira ficam dentro dela.</p>
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
