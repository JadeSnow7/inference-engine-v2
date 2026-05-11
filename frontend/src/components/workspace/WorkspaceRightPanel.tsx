import { Clock } from 'lucide-react'

export function WorkspaceRightPanel() {
  return (
    <aside className="hidden w-80 shrink-0 border-l border-scholar-border bg-scholar-bg-surface xl:flex xl:flex-col">
      <div className="border-b border-scholar-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-scholar-text-primary">
          <Clock size={15} />
          研究动态
        </div>
      </div>
      <div className="flex-1 p-4 text-sm text-scholar-text-secondary">
        右侧 AI / 证据 / 历史面板将在后续任务接入统一数据源。
      </div>
    </aside>
  )
}
