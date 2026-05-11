import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './utils'

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode
  tone?: BadgeTone
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-scholar-text-secondary',
  primary: 'bg-blue-50 text-scholar-primary',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-600',
}

export function Badge({ children, className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold', toneClasses[tone], className)} {...props}>
      {children}
    </span>
  )
}
