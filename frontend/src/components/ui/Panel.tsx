import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './utils'

interface PanelProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
}

export function Panel({ children, className, ...props }: PanelProps) {
  return (
    <section className={cn('rounded-3xl border border-scholar-border bg-white p-6 shadow-sm', className)} {...props}>
      {children}
    </section>
  )
}
