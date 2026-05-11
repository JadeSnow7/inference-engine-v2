import type { InputHTMLAttributes } from 'react'
import { cn } from './utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ className, id, label, ...props }: InputProps) {
  const inputId = id ?? (label ? label.replace(/\s+/g, '-').toLowerCase() : undefined)

  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-semibold text-scholar-text-secondary">{label}</span>}
      <input
        id={inputId}
        className={cn(
          'h-10 w-full rounded-xl border border-scholar-border bg-white px-3 text-sm text-scholar-text-primary outline-none transition placeholder:text-scholar-text-weak focus:border-scholar-primary/40 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-scholar-bg-canvas disabled:opacity-70',
          className,
        )}
        {...props}
      />
    </label>
  )
}
