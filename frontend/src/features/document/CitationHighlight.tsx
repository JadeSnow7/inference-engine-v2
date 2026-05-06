import type { ReactNode } from 'react'

export function CitationHighlight({
  active = false,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
}) {
  const className = `rounded-md px-1 py-0.5 font-medium transition ${
    active ? 'bg-blue-100 text-scholar-primary ring-1 ring-blue-200' : 'bg-emerald-100 text-emerald-700'
  }`

  if (onClick) {
    return (
      <button
        type="button"
        className={`${className} cursor-pointer hover:bg-blue-100 hover:text-scholar-primary`}
        onClick={onClick}
      >
        {children}
      </button>
    )
  }

  return (
    <mark className={className}>
      {children}
    </mark>
  )
}
