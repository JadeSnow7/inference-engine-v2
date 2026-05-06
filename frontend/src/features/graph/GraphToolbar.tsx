import { Download, Filter, MoreHorizontal, Share2 } from 'lucide-react'

export function GraphToolbar() {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex gap-2">
        <button className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-scholar-primary">核心概念</button>
        <button className="rounded-lg bg-scholar-bg-canvas px-3 py-1.5 text-xs font-semibold text-scholar-text-secondary">方法</button>
      </div>
      <div className="flex items-center gap-1 text-scholar-text-secondary">
        <button className="rounded-lg p-1.5 transition hover:bg-scholar-bg-canvas" aria-label="筛选">
          <Filter size={15} />
        </button>
        <button className="rounded-lg p-1.5 transition hover:bg-scholar-bg-canvas" aria-label="分享">
          <Share2 size={15} />
        </button>
        <button className="rounded-lg p-1.5 transition hover:bg-scholar-bg-canvas" aria-label="导出">
          <Download size={15} />
        </button>
        <button className="rounded-lg p-1.5 transition hover:bg-scholar-bg-canvas" aria-label="更多">
          <MoreHorizontal size={15} />
        </button>
      </div>
    </div>
  )
}
