import type { ReactNode } from 'react'

interface StateBlockProps {
  title: string
  description?: string
  icon?: ReactNode
}

export function StateBlock({ title, description, icon }: StateBlockProps) {
  return (
    <div role="status" aria-label={title} className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-scholar-border bg-scholar-bg-canvas px-6 text-center">
      {icon && <div className="mb-3 text-scholar-text-weak">{icon}</div>}
      <div className="text-sm font-semibold text-scholar-text-primary">{title}</div>
      {description && <p className="mt-1 text-xs leading-5 text-scholar-text-secondary">{description}</p>}
    </div>
  )
}
