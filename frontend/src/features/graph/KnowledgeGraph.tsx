import {
  Background,
  Controls,
  ReactFlow,
} from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import { useMemo } from 'react'
import '@xyflow/react/dist/style.css'
import { useWorkspaceStore } from '../../store/workspace'

type KnowledgeNodeData = {
  label: string
}

export function KnowledgeGraph() {
  const selectedGraphNodeId = useWorkspaceStore(state => state.selectedGraphNodeId)
  const setSelectedGraphNode = useWorkspaceStore(state => state.setSelectedGraphNode)
  const workspaceGraphNodes = useWorkspaceStore(state => state.graphNodes)
  const workspaceGraphEdges = useWorkspaceStore(state => state.graphEdges)

  const nodes = useMemo<Node<KnowledgeNodeData>[]>(() => workspaceGraphNodes.map(node => {
    const selected = node.id === selectedGraphNodeId
    const isCore = node.type === 'core'
    return {
      id: node.id,
      position: node.position,
      data: { label: node.label },
      className: [
        'rounded-full border text-center shadow-sm transition',
        isCore ? 'min-w-[104px] bg-gradient-to-br from-scholar-primary to-scholar-discovery text-white border-transparent font-black shadow-purple-200' : '',
        !isCore && selected ? 'min-w-[118px] bg-blue-50 text-scholar-primary border-scholar-primary font-bold' : '',
        !isCore && !selected ? 'min-w-[118px] bg-white text-scholar-text-primary border-blue-100 font-semibold' : '',
      ].join(' '),
      style: {
        padding: isCore ? 18 : 12,
        fontSize: isCore ? 14 : 12,
      },
    }
  }), [selectedGraphNodeId, workspaceGraphNodes])

  const edges = useMemo<Edge[]>(() => workspaceGraphEdges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.source === selectedGraphNodeId || edge.target === selectedGraphNodeId,
    labelStyle: { fill: '#646a73', fontSize: 10, fontWeight: 600 },
    style: {
      stroke: edge.source === selectedGraphNodeId || edge.target === selectedGraphNodeId ? '#3370ff' : '#a8b5ff',
      strokeWidth: edge.source === selectedGraphNodeId || edge.target === selectedGraphNodeId ? 2 : 1.3,
    },
  })), [selectedGraphNodeId, workspaceGraphEdges])

  return (
    <div className="h-[340px] bg-gradient-to-br from-white via-[#fbfcff] to-blue-50/70">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={(_, node) => setSelectedGraphNode(node.id)}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        attributionPosition="bottom-left"
      >
        <Background color="#dfe6ff" gap={18} size={1} />
        <Controls position="bottom-right" className="rounded-xl border border-scholar-border bg-white shadow-sm" />
      </ReactFlow>
    </div>
  )
}
