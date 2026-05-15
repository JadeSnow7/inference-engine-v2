import type { ReactNode } from 'react'
import { BookMarked, GitBranch, Network, Sparkles } from 'lucide-react'
import { EvidenceContextPanel } from '../evidence/EvidenceContextPanel'
import { GraphContextPanel } from '../graph/GraphContextPanel'
import { ReviewQueuePanel } from '../review/ReviewQueuePanel'
import { VersionContextPanel } from '../version/VersionContextPanel'
import { useWorkspaceStore } from '../../store/workspace'
import type { RightPanelMode } from '../../types/workspace'

const tabs: Array<{ id: RightPanelMode; label: string; icon: ReactNode }> = [
  { id: 'review', label: '审阅', icon: <Sparkles size={14} /> },
  { id: 'evidence', label: '证据', icon: <BookMarked size={14} /> },
  { id: 'graph', label: '图谱', icon: <Network size={14} /> },
  { id: 'versions', label: '版本', icon: <GitBranch size={14} /> },
]

export function WorkspaceContextDrawer() {
  const mode = useWorkspaceStore(state => state.rightPanelMode)
  const setMode = useWorkspaceStore(state => state.setRightPanelMode)

  return (
    <aside aria-label="工作台上下文" className="hidden w-[400px] shrink-0 flex-col overflow-hidden rounded-2xl border border-scholar-border bg-white shadow-sm xl:flex">
      <div className="border-b border-scholar-border px-4 py-3">
        <h2 className="text-base font-black text-scholar-text-primary">上下文</h2>
        <div role="tablist" aria-label="工作台上下文" className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-scholar-bg-canvas p-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={mode === tab.id}
              className={`flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                mode === tab.id ? 'bg-white text-scholar-primary shadow-sm' : 'text-scholar-text-secondary'
              }`}
              onClick={() => setMode(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {mode === 'review' && <ReviewQueuePanel />}
        {mode === 'evidence' && <EvidenceContextPanel />}
        {mode === 'graph' && <GraphContextPanel />}
        {mode === 'versions' && <VersionContextPanel />}
      </div>
    </aside>
  )
}
