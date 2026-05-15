import { useWorkspaceStore } from '../../store/workspace'
import { GraphToolbar } from './GraphToolbar'
import { KnowledgeGraph } from './KnowledgeGraph'
import { NodeDetailCard } from './NodeDetailCard'

export function GraphContextPanel() {
  const selectedGraphNodeId = useWorkspaceStore(state => state.selectedGraphNodeId)
  const graphNodes = useWorkspaceStore(state => state.graphNodes)
  const selectedNode = graphNodes.find(node => node.id === selectedGraphNodeId) ?? graphNodes[0]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <GraphToolbar />
      <div className="min-h-0 flex-1 border-y border-scholar-border">
        {graphNodes.length > 0 ? <KnowledgeGraph /> : <div className="p-4 text-sm text-scholar-text-secondary">暂无图谱节点</div>}
      </div>
      <div className="p-3">
        {selectedNode ? <NodeDetailCard node={selectedNode} /> : <div className="text-sm text-scholar-text-secondary">暂无节点详情</div>}
      </div>
    </div>
  )
}
