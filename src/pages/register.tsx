import { useState } from 'react'
import { useRouter } from 'next/router'
import type { ChangeEvent } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function Register() {
  const router = useRouter()
  const callbackUrl = (router.query.callbackUrl as string) || ''
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPassword) return setError('As senhas não coincidem')
    if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres')
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })

    if (res.ok) {
      const query = callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : '?registered=1'
      router.push(`/login${query}`)
    } else {
      const data = await res.json()
      setError(data.error || 'Erro ao criar conta')
    }
    setLoading(false)
  }

  return (
    <AppLayout title="Criar conta - PayBox">
      <div className="py-8">
        <h1 className="mb-6 text-center text-2xl font-bold">Criar conta</h1>
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <Input label="Nome" value={name} onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
          <Input type="email" label="E-mail" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required />
          <Input
            type="password"
            label="Senha"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            required
          />
          <Input
            type="password"
            label="Confirmar senha"
            value={confirmPassword}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            required
          />
          {error && <p className="text-center text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" isLoading={loading}>
            Criar conta
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          Já tem conta?{' '}
          <Link href="/login" className="text-primary-400 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </AppLayout>
  )
}
