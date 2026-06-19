import { cn } from '@/lib/utils'
import { ReactNode } from 'react'
import Head from 'next/head'

interface AppLayoutProps {
  children: ReactNode
  title?: string
  className?: string
}

export default function AppLayout({ children, title = 'PayBox', className }: AppLayoutProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
      </Head>
      <main className={cn('mx-auto min-h-screen max-w-md bg-dark-900 px-4 py-6 sm:max-w-2xl', className)}>{children}</main>
    </>
  )
}
