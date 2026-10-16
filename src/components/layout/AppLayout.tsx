import { cn } from '@/lib/utils'
import { ReactNode } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { LogOut } from 'lucide-react'

interface AppLayoutProps {
  children: ReactNode
  title?: string
  className?: string
}

function UserNav() {
  const { data: session } = useSession()
  if (!session?.user) return null
  const initial = (session.user.name || session.user.email || '?').trim().charAt(0)

  return (
    <div className="absolute right-4 top-[34px] z-10 flex items-center gap-0.5">
      <Link
        href="/settings/profile"
        title="Meu perfil"
        aria-label="Meu perfil"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500/15 text-sm font-semibold uppercase text-primary-300 ring-1 ring-primary-500/40 transition-colors hover:bg-primary-500/25"
      >
        {initial}
      </Link>
      <button
        type="button"
        title="Sair"
        aria-label="Sair"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-dark-700 hover:text-white"
      >
        <LogOut size={18} />
      </button>
    </div>
  )
}

export default function AppLayout({ children, title = 'PayBox', className }: AppLayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <main className={cn('relative mx-auto min-h-screen max-w-md bg-dark-900 px-4 py-6 sm:max-w-2xl', className)}>
        <UserNav />
        {children}
      </main>
    </>
  )
}
