import { useMemo, useState } from 'react'
import { useWorkspaceStore } from '../../store/workspace'
import { GraphToolbar, type GraphToolbarFilter } from './GraphToolbar'
import { KnowledgeGraph } from './KnowledgeGraph'
import { NodeDetailCard } from './NodeDetailCard'

export function GraphContextPanel() {
  const selectedGraphNodeId = useWorkspaceStore(state => state.selectedGraphNodeId)
  const graphNodes = useWorkspaceStore(state => state.graphNodes)
  const [graphFilter, setGraphFilter] = useState<GraphToolbarFilter>(null)
  const filteredGraphNodes = useMemo(() => (
    graphFilter ? graphNodes.filter(node => node.type === graphFilter) : graphNodes
  ), [graphFilter, graphNodes])
  const filteredGraphNodeIds = useMemo(() => new Set(filteredGraphNodes.map(node => node.id)), [filteredGraphNodes])
  const selectedNode = filteredGraphNodes.find(node => node.id === selectedGraphNodeId) ?? filteredGraphNodes[0]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphToolbar activeFilter={graphFilter} onFilterChange={setGraphFilter} />
      <div className="min-h-0 flex-1 border-y border-scholar-border">
        {filteredGraphNodes.length > 0 ? (
          <KnowledgeGraph visibleNodeIds={graphFilter ? filteredGraphNodeIds : undefined} />
        ) : (
          <div className="p-4 text-sm text-scholar-text-secondary">暂无图谱节点</div>
        )}
      </div>
      <div className="p-3">
        {selectedNode ? <NodeDetailCard node={selectedNode} /> : <div className="text-sm text-scholar-text-secondary">暂无节点详情</div>}
      </div>
    </div>
  )
}
