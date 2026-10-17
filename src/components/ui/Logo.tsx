import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  showName?: boolean
  className?: string
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden="true">
      <path transform="translate(0,-2)" d="M26 4 46 14 26 24 6 14z" fill="#34d399" />
      <path transform="translate(-1.7,1)" d="M6 14 26 24v24L6 38z" fill="#10b981" />
      <path transform="translate(1.7,1)" d="M26 24 46 14v24L26 48z" fill="#059669" />
    </svg>
  )
}

export default function Logo({ size = 32, showName = true, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} />
      {showName && (
        <span className="font-bold tracking-tight text-slate-50" style={{ fontSize: size * 0.75 }}>
          PayBox
        </span>
      )}
    </span>
  )
}
