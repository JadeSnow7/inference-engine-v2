import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from './utils'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  children: ReactNode
  'aria-label': string
}

export function IconButton({ children, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl text-scholar-text-secondary transition hover:bg-scholar-bg-canvas hover:text-scholar-primary focus:outline-none focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
