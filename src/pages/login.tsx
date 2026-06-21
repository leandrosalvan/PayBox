import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'
import type { ChangeEvent } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (session) return { redirect: { destination: '/wallets', permanent: false } }
  return { props: {} }
}

export default function Login() {
  const router = useRouter()
  const callbackUrl = (router.query.callbackUrl as string) || '/wallets'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { email, password, redirect: false, callbackUrl })
    if (result?.ok) {
      router.push(callbackUrl)
    } else {
      setError('E-mail ou senha inválidos')
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    setError('')
    try {
      await signIn('google', { callbackUrl })
    } catch {
      setError('Erro ao conectar com o Google. Verifique sua conexão.')
      setLoading(false)
    }
  }

  return (
    <AppLayout title="Entrar - PayBox">
      <div className="flex flex-col items-center justify-center py-12">
        <h1 className="mb-2 text-3xl font-bold text-primary-400">PayBox</h1>
        <p className="mb-8 text-slate-400">Controle de despesas compartilhado</p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <Input type="email" label="E-mail" value={email} onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} required />
          <Input
            type="password"
            label="Senha"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-center text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full" isLoading={loading}>
            Entrar
          </Button>
        </form>

        <div className="my-4 flex w-full items-center gap-2">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-sm text-slate-500">ou</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        <Button variant="secondary" className="w-full" onClick={handleGoogle} isLoading={loading}>
          Entrar com Google
        </Button>

        <div className="mt-6 flex flex-col items-center gap-2 text-sm text-slate-400">
          <Link href="/forgot-password" className="text-primary-400 hover:underline">
            Esqueci minha senha
          </Link>
          <span>
            Não tem conta?{' '}
            <Link href="/register" className="text-primary-400 hover:underline">
              Criar conta
            </Link>
          </span>
        </div>
      </div>
    </AppLayout>
  )
}
