import { cn } from '@/lib/utils'
import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-slate-700 bg-dark-800 p-4 shadow-sm',
        onClick && 'cursor-pointer hover:bg-dark-700',
        className
      )}
    >
      {children}
    </div>
  )
}
