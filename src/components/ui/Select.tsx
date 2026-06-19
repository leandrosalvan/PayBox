import { cn } from '@/lib/utils'
import { SelectHTMLAttributes, forwardRef } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, error, options, className, ...props }, ref) => {
  return (
    <div className="w-full">
      {label && <label className="mb-1 block text-sm text-slate-300">{label}</label>}
      <select
        ref={ref}
        className={cn(
          'w-full rounded-lg border border-slate-600 bg-dark-800 px-4 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
          error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
    </div>
  )
})
Select.displayName = 'Select'
export default Select
