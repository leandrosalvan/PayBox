import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import AppLayout from '@/components/layout/AppLayout'

export default function Home() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') router.replace('/wallets')
    if (status === 'unauthenticated') router.replace('/login')
  }, [status, router])

  return (
    <AppLayout>
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    </AppLayout>
  )
}
