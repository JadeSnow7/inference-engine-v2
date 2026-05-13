import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { searchItems, type SearchResult, type SearchScope } from '../../api/search'

interface SearchBoxProps {
  ariaLabel: string
  placeholder: string
  scope: SearchScope
  wrapperClassName: string
  inputClassName: string
}

export function SearchBox({ ariaLabel, placeholder, scope, wrapperClassName, inputClassName }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const trimmedQuery = query.trim()

  useEffect(() => {
    if (!trimmedQuery) {
      setItems([])
      setIsLoading(false)
      setErrorMessage(null)
      return
    }

    let isCurrent = true
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true)
      setErrorMessage(null)
      searchItems({ q: trimmedQuery, scope })
        .then(response => {
          if (!isCurrent) return
          setItems(response.items)
        })
        .catch(error => {
          if (!isCurrent) return
          setItems([])
          setErrorMessage(error instanceof Error ? error.message : '搜索暂时不可用')
        })
        .finally(() => {
          if (isCurrent) {
            setIsLoading(false)
          }
        })
    }, 250)

    return () => {
      isCurrent = false
      window.clearTimeout(timeoutId)
    }
  }, [scope, trimmedQuery])

  const showPanel = Boolean(trimmedQuery)

  return (
    <div className={wrapperClassName}>
      <label className="relative flex w-full items-center">
        <Search className="absolute left-3 text-scholar-text-weak" size={16} />
        <input
          aria-label={ariaLabel}
          value={query}
          onChange={event => setQuery(event.target.value)}
          className={inputClassName}
          placeholder={placeholder}
        />
      </label>

      {showPanel && (
        <div className="absolute left-0 top-full z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-scholar-border bg-white p-2 shadow-xl">
          {isLoading && <div className="px-3 py-2 text-xs font-medium text-scholar-text-secondary">正在搜索...</div>}
          {!isLoading && errorMessage && <div className="px-3 py-2 text-xs font-medium text-rose-600">{errorMessage}</div>}
          {!isLoading && !errorMessage && items.length === 0 && (
            <div className="px-3 py-2 text-xs font-medium text-scholar-text-secondary">未找到匹配结果</div>
          )}
          {!isLoading && !errorMessage && items.map(item => (
            <a
              key={item.id}
              href={item.target || '#'}
              className="block w-full rounded-lg px-3 py-2 text-left transition hover:bg-scholar-bg-canvas"
              onClick={() => setQuery('')}
            >
              <div className="truncate text-sm font-semibold text-scholar-text-primary">{item.title}</div>
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-scholar-text-secondary">{item.excerpt}</div>
              {item.meta && <div className="mt-1 text-[11px] font-medium text-scholar-text-weak">{item.meta}</div>}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
