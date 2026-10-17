import { cn } from '@/lib/utils'
import { ReactNode } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { ArrowLeft, LogOut } from 'lucide-react'
import { LogoMark } from '@/components/ui/Logo'

interface AppLayoutProps {
  children: ReactNode
  title?: string
  className?: string
  backHref?: string
  backLabel?: string
  nav?: ReactNode
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

function TopBar({ backHref, backLabel = 'Voltar', nav }: Pick<AppLayoutProps, 'backHref' | 'backLabel' | 'nav'>) {
  const { data: session } = useSession()
  if (!session?.user) return null

  return (
    <div className="relative mt-2.5 flex h-9 items-center gap-1">
      <Link href="/wallets" aria-label="PayBox" className="mr-1 flex shrink-0 items-center gap-2">
        <LogoMark size={26} />
        <span className="text-lg font-bold tracking-tight text-slate-50">PayBox</span>
      </Link>
      {backHref && (
        <Link
          href={backHref}
          title={backLabel}
          aria-label={backLabel}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={20} />
        </Link>
      )}
      {nav && <div className="pointer-events-none absolute inset-x-0 flex justify-center px-28"><div className="pointer-events-auto min-w-0">{nav}</div></div>}
    </div>
  )
}

export default function AppLayout({ children, title = 'PayBox', className, backHref, backLabel, nav }: AppLayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <main className={cn('relative mx-auto min-h-screen max-w-md bg-dark-900 px-4 py-6 sm:max-w-2xl', className)}>
        <UserNav />
        <TopBar backHref={backHref} backLabel={backLabel} nav={nav} />
        {children}
      </main>
    </>
  )
}
