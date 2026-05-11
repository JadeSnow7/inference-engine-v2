import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './utils'

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode
  title?: string
}

export function Card({ children, className, title, ...props }: CardProps) {
  return (
    <section
      aria-label={title}
      className={cn('rounded-2xl border border-scholar-border bg-white p-5 shadow-sm', className)}
      {...props}
    >
      {title && <h3 className="mb-3 text-base font-bold text-scholar-text-primary">{title}</h3>}
      {children}
    </section>
  )
}
