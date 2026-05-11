import type { ReactNode } from 'react'
import { cn } from './utils'

interface TabItem {
  id: string
  label: string
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (value: string) => void
}

export function Tabs({ items, value, onChange }: TabsProps) {
  return (
    <div className="inline-flex rounded-xl bg-scholar-bg-canvas p-1">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
            value === item.id ? 'bg-white text-scholar-primary shadow-sm' : 'text-scholar-text-secondary hover:text-scholar-text-primary',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

export function TabPanel({ children }: { children: ReactNode }) {
  return <div>{children}</div>
}
