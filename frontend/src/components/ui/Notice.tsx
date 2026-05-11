import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from './utils'

interface NoticeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Notice({ children, className, ...props }: NoticeProps) {
  return (
    <div className={cn('rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-scholar-academic', className)} {...props}>
      {children}
    </div>
  )
}
