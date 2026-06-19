import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import AppLayout from '@/components/layout/AppLayout'
import Button from '@/components/ui/Button'

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context)
  if (!session) return { redirect: { destination: '/login', permanent: false } }
  return { props: {} }
}

export default function AcceptInvite() {
  const router = useRouter()
  const { token } = router.query
  const [invite, setInvite] = useState<any>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token || typeof token !== 'string') return
    fetch(`/api/invites/${token}`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setInvite(data.invite)
        } else {
          const data = await res.json()
          setError(data.error || 'Convite inválido')
        }
      })
      .catch(() => setError('Erro ao carregar convite'))
  }, [token])

  async function handleAccept() {
    if (!token) return
    setLoading(true)
    const res = await fetch(`/api/invites/${token}`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      router.push(`/wallets/${data.walletId}`)
    } else {
      setError(data.error || 'Erro ao aceitar convite')
    }
    setLoading(false)
  }

  return (
    <AppLayout title="Convite - PayBox">
      <div className="flex h-[80vh] flex-col items-center justify-center text-center">
        <h1 className="mb-4 text-2xl font-bold">Convite para PayBox</h1>
        {error && <p className="mb-4 text-red-400">{error}</p>}
        {invite && (
          <>
            <p className="mb-2 text-slate-300">
              Você foi convidado para participar da carteira <strong>{invite.wallet.name}</strong>.
            </p>
            <Button onClick={handleAccept} isLoading={loading}>
              Aceitar convite
            </Button>
          </>
        )}
        {!invite && !error && (
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        )}
      </div>
    </AppLayout>
  )
}
