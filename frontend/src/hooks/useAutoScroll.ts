import { useEffect, useRef } from 'react'

export function useAutoScroll(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Only auto-scroll when user is near the bottom (< 120px)
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [dep])

  return ref
}
