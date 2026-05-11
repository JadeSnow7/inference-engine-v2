import type { InputHTMLAttributes } from 'react'
import { Search } from 'lucide-react'
import { cn } from './utils'

export function SearchInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="relative block">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-scholar-text-weak" size={16} />
      <input
        className={cn(
          'h-10 w-full rounded-xl border border-scholar-border bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-scholar-text-weak focus:border-scholar-primary/40 focus:ring-4 focus:ring-blue-100',
          className,
        )}
        {...props}
      />
    </label>
  )
}
