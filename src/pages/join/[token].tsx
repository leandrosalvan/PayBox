import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession, useSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  return { props: { sessionExists: !!session } }
}

export default function JoinWallet({ sessionExists }: { sessionExists: boolean }) {
  const router = useRouter()
  const { token } = router.query
  const { data: session } = useSession()
  const [wallet, setWallet] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token || typeof token !== 'string') return
    fetch(`/api/join/${token}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setWallet(data.wallet)
        } else {
          const data = await res.json()
          setError(data.error || 'Convite inválido')
        }
      })
      .catch(() => setError('Erro ao carregar convite'))
  }, [token])

  async function handleJoin() {
    if (!token) return
    setLoading(true)
    const res = await fetch(`/api/join/${token}`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      router.push(`/wallets/${data.walletId}`)
    } else {
      if (res.status === 401) {
        router.push(`/login?callbackUrl=/join/${token}`)
      } else {
        setError(data.error || 'Erro ao entrar na carteira')
      }
    }
    setLoading(false)
  }

  if (error) {
    return (
      <AppLayout title="Convite - PayBox">
        <div className="flex h-[80vh] flex-col items-center justify-center text-center">
          <h1 className="mb-4 text-2xl font-bold">Convite</h1>
          <p className="text-red-400">{error}</p>
        </div>
      </AppLayout>
    )
  }

  if (!wallet) {
    return (
      <AppLayout title="Convite - PayBox">
        <div className="flex h-[80vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title={`Convite - ${wallet.name}`}>
      <div className="flex h-[80vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-2 text-2xl font-bold">Você foi convidado</h1>
        <p className="mb-6 text-slate-300">
          para participar da carteira <strong className="text-white">{wallet.name}</strong>
        </p>
        {!session && !sessionExists ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Faça login ou crie uma conta para aceitar.</p>
            <Button className="w-full" onClick={() => router.push(`/login?callbackUrl=/join/${token}`)}>
              Entrar
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => router.push(`/register?callbackUrl=/join/${token}`)}>
              Criar conta
            </Button>
          </div>
        ) : (
          <Button onClick={handleJoin} isLoading={loading}>
            Entrar na carteira
          </Button>
        )}
      </div>
    </AppLayout>
  )
}
