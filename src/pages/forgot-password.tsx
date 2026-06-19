import { useState } from 'react'
import AppLayout from '@/components/layout/AppLayout'
import type { ChangeEvent } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    const res = await fetch('/api/reset-password/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage('Se o e-mail existir, enviaremos um link de redefinição.')
    } else {
      setError(data.error || 'Erro ao enviar e-mail')
    }
    setLoading(false)
  }

  return (
    <AppLayout title="Esqueci a senha - PayBox">
      <div className="py-8">
        <h1 className="mb-6 text-center text-2xl font-bold">Redefinir senha</h1>
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <Input type="email" label="E-mail" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required />
          {message && <p className="text-center text-sm text-primary-400">{message}</p>}
          {error && <p className="text-center text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" isLoading={loading}>
            Enviar link
          </Button>
        </form>
      </div>
    </AppLayout>
  )
}
