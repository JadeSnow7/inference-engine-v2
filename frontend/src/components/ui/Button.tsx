import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from './utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  loading?: boolean
  variant?: ButtonVariant
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-scholar-primary text-white shadow-sm hover:bg-scholar-primary-hover',
  secondary: 'border border-scholar-border bg-white text-scholar-text-primary hover:bg-scholar-bg-canvas',
  ghost: 'text-scholar-text-secondary hover:bg-scholar-bg-canvas hover:text-scholar-primary',
  danger: 'bg-red-500 text-white shadow-sm hover:bg-red-600',
}

export function Button({ children, className, disabled, loading = false, type = 'button', variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 aria-hidden="true" size={16} className="animate-spin" />}
      {loading && <span>处理中</span>}
      <span>{children}</span>
    </button>
  )
}
