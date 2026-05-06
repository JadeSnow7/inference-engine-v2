import type { SuggestionChange, SuggestionChangeType } from '../types/workspace'

export function getChangeTone(type: SuggestionChangeType): {
  label: string
  badgeClassName: string
  panelClassName: string
} {
  switch (type) {
    case 'delete':
      return {
        label: '删除',
        badgeClassName: 'bg-red-50 text-red-600',
        panelClassName: 'bg-red-50/70 text-red-700 line-through decoration-red-400',
      }
    case 'insert':
      return {
        label: '新增',
        badgeClassName: 'bg-emerald-50 text-emerald-600',
        panelClassName: 'bg-emerald-50/80 text-emerald-700',
      }
    case 'modify':
      return {
        label: '修改',
        badgeClassName: 'bg-amber-50 text-amber-600',
        panelClassName: 'bg-amber-50/80 text-amber-700',
      }
  }
}

export function getCurrentChange(changes: SuggestionChange[], index: number): SuggestionChange | null {
  return changes[Math.min(Math.max(index, 0), Math.max(changes.length - 1, 0))] ?? null
}
