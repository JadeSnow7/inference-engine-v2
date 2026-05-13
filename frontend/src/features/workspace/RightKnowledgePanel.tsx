import { useMemo, useState } from 'react'
import { List, Network } from 'lucide-react'
import { useWorkspaceStore } from '../../store/workspace'
import { GraphToolbar, type GraphToolbarFilter } from '../graph/GraphToolbar'
import { KnowledgeGraph } from '../graph/KnowledgeGraph'
import { NodeDetailCard } from '../graph/NodeDetailCard'

export function RightKnowledgePanel() {
  const rightPanelMode = useWorkspaceStore(state => state.rightPanelMode)
  const setRightPanelMode = useWorkspaceStore(state => state.setRightPanelMode)
  const selectedGraphNodeId = useWorkspaceStore(state => state.selectedGraphNodeId)
  const setSelectedGraphNode = useWorkspaceStore(state => state.setSelectedGraphNode)
  const graphNodes = useWorkspaceStore(state => state.graphNodes)
  const [graphFilter, setGraphFilter] = useState<GraphToolbarFilter>(null)
  const filteredGraphNodes = useMemo(() => (
    graphFilter ? graphNodes.filter(node => node.type === graphFilter) : graphNodes
  ), [graphFilter, graphNodes])
  const filteredGraphNodeIds = useMemo(() => new Set(filteredGraphNodes.map(node => node.id)), [filteredGraphNodes])
  const selectedNode = filteredGraphNodes.find(node => node.id === selectedGraphNodeId) ?? filteredGraphNodes[0]
  const hasGraphNodes = filteredGraphNodes.length > 0

  return (
    <aside className="hidden w-[400px] shrink-0 flex-col overflow-hidden rounded-2xl border border-scholar-border bg-white shadow-sm 2xl:flex">
      <div className="flex items-center justify-between border-b border-scholar-border px-4 py-3">
        <h2 className="text-base font-black">知识图谱</h2>
        <div className="flex rounded-xl bg-scholar-bg-canvas p-1">
          <button
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              rightPanelMode === 'graph' ? 'bg-white text-scholar-primary shadow-sm' : 'text-scholar-text-secondary'
            }`}
            onClick={() => setRightPanelMode('graph')}
          >
            <Network size={14} />
            图谱视图
          </button>
          <button
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              rightPanelMode === 'list' ? 'bg-white text-scholar-primary shadow-sm' : 'text-scholar-text-secondary'
            }`}
            onClick={() => setRightPanelMode('list')}
          >
            <List size={14} />
            列表视图
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-[1.05] border-b border-scholar-border">
        <GraphToolbar activeFilter={graphFilter} onFilterChange={setGraphFilter} />
        {!hasGraphNodes ? (
          <div className="flex h-[340px] items-center justify-center bg-scholar-bg-canvas px-6 text-center text-sm text-scholar-text-secondary">
            暂无图谱节点
          </div>
        ) : rightPanelMode === 'graph' ? (
          <KnowledgeGraph visibleNodeIds={graphFilter ? filteredGraphNodeIds : undefined} />
        ) : (
          <div className="grid max-h-[360px] gap-2 overflow-y-auto p-4">
            {filteredGraphNodes.map(node => (
              <button
                key={node.id}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  selectedGraphNodeId === node.id ? 'border-scholar-primary bg-blue-50' : 'border-scholar-border hover:bg-scholar-bg-canvas'
                }`}
                onClick={() => setSelectedGraphNode(node.id)}
              >
                <div className="text-sm font-bold">{node.label}</div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-scholar-text-secondary">{node.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {selectedNode ? (
          <NodeDetailCard node={selectedNode} />
        ) : (
          <div className="flex h-full min-h-32 items-center justify-center rounded-xl border border-dashed border-scholar-border bg-scholar-bg-canvas text-sm text-scholar-text-secondary">
            暂无节点详情
          </div>
        )}
      </div>
    </aside>
  )
}
