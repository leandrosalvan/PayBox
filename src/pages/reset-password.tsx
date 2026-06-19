import { useState } from 'react'
import { useRouter } from 'next/router'
import AppLayout from '@/components/layout/AppLayout'
import type { ChangeEvent } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function ResetPassword() {
  const router = useRouter()
  const token = (router.query.token as string) || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) return setError('As senhas não coincidem')
    if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres')
    setLoading(true)
    setError('')
    const res = await fetch('/api/reset-password/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage('Senha redefinida com sucesso! Redirecionando...')
      setTimeout(() => router.push('/login'), 2000)
    } else {
      setError(data.error || 'Erro ao redefinir senha')
    }
    setLoading(false)
  }

  return (
    <AppLayout title="Redefinir senha - PayBox">
      <div className="py-8">
        <h1 className="mb-6 text-center text-2xl font-bold">Nova senha</h1>
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <Input type="password" label="Nova senha" value={password} onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} required />
          <Input type="password" label="Confirmar senha" value={confirmPassword} onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)} required />
          {message && <p className="text-center text-sm text-primary-400">{message}</p>}
          {error && <p className="text-center text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" isLoading={loading}>
            Redefinir senha
          </Button>
        </form>
      </div>
    </AppLayout>
  )
}
