import { Download, Filter, MoreHorizontal, Share2 } from 'lucide-react'
import type { GraphNodeType } from '../../types/workspace'

export type GraphToolbarFilter = Extract<GraphNodeType, 'core' | 'method'> | null

export function GraphToolbar({
  activeFilter,
  onFilterChange,
}: {
  activeFilter: GraphToolbarFilter
  onFilterChange: (filter: GraphToolbarFilter) => void
}) {
  const disabledTitle = '演示版暂未接入该编辑命令'

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex gap-2">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeFilter === 'core' ? 'bg-blue-50 text-scholar-primary' : 'bg-scholar-bg-canvas text-scholar-text-secondary'
          }`}
          onClick={() => onFilterChange(activeFilter === 'core' ? null : 'core')}
        >
          核心概念
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            activeFilter === 'method' ? 'bg-blue-50 text-scholar-primary' : 'bg-scholar-bg-canvas text-scholar-text-secondary'
          }`}
          onClick={() => onFilterChange(activeFilter === 'method' ? null : 'method')}
        >
          方法
        </button>
      </div>
      <div className="flex items-center gap-1 text-scholar-text-secondary">
        <button className="rounded-lg p-1.5 transition hover:bg-scholar-bg-canvas" aria-label="筛选">
          <Filter size={15} />
        </button>
        <button className="rounded-lg p-1.5 opacity-45" aria-label="分享" disabled title={disabledTitle}>
          <Share2 size={15} />
        </button>
        <button className="rounded-lg p-1.5 opacity-45" aria-label="导出" disabled title={disabledTitle}>
          <Download size={15} />
        </button>
        <button className="rounded-lg p-1.5 opacity-45" aria-label="更多" disabled title={disabledTitle}>
          <MoreHorizontal size={15} />
        </button>
      </div>
    </div>
  )
}
