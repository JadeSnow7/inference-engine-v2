import { useCallback, useEffect, useState } from 'react'
import { ChevronRight, Network, Search, X } from 'lucide-react'
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useNavigate } from 'react-router-dom'
import { fetchGraph, type GraphEdge, type GraphNode } from '../api/graph'
import { Button, Card, StateBlock, Tabs } from '../components/ui'
import { useLayoutStore } from '../store/layout'

const graphTabs = [
  { id: 'topic', label: '主题图谱' },
  { id: 'paper', label: '文献关系' },
  { id: 'gap', label: '研究空白' },
]

interface FlowNodeData extends Record<string, unknown> {
  label: string
  description: string
  nodeType: string
  referenceIds: string[]
}

function nodeClassName(type: string): string {
  const base = 'min-w-[150px] shadow-sm rounded-lg text-sm p-3 text-center'
  if (type === 'paper') return `${base} border-2 border-emerald-400 bg-emerald-50 font-semibold text-emerald-700`
  if (type === 'gap') return `${base} border-2 border-rose-300 bg-rose-50 font-semibold text-rose-700`
  if (type === 'method') return `${base} border border-indigo-200 bg-indigo-50 font-medium text-indigo-700`
  return `${base} border-2 border-scholar-discovery/50 bg-white font-semibold text-scholar-text-primary`
}

function toFlowNode(node: GraphNode): Node<FlowNodeData> {
  return {
    id: node.id,
    position: node.position,
    data: {
      label: node.label,
      description: node.description,
      nodeType: node.type,
      referenceIds: node.referenceIds,
    },
    className: nodeClassName(node.type),
  }
}

function toFlowEdge(edge: GraphEdge): Edge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label || undefined,
    labelStyle: { fill: '#646a73', fontSize: 10 },
    style: { stroke: '#dee0e3', strokeWidth: 1.5 },
  }
}

export default function Discovery() {
  const navigate = useNavigate()
  const setWorkbenchContext = useLayoutStore(state => state.setWorkbenchContext)
  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [activeTab, setActiveTab] = useState('topic')
  const [selectedNode, setSelectedNode] = useState<Node<FlowNodeData> | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true
    setIsLoading(true)
    setErrorMessage(null)

    fetchGraph({ view: activeTab })
      .then(response => {
        if (!isCurrent) return
        const nextNodes = response.nodes.map(toFlowNode)
        setNodes(nextNodes)
        setEdges(response.edges.map(toFlowEdge))
        setSelectedNode(nextNodes[0] ?? null)
      })
      .catch(error => {
        if (!isCurrent) return
        setNodes([])
        setEdges([])
        setSelectedNode(null)
        setErrorMessage(error instanceof Error ? error.message : '知识图谱暂时不可用')
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false)
        }
      })

    return () => {
      isCurrent = false
    }
  }, [activeTab])

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<FlowNodeData>>[]) => setNodes(nds => applyNodeChanges(changes, nds)),
    [],
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => setEdges(eds => applyEdgeChanges(changes, eds)),
    [],
  )

  const handleTakeToWorkbench = () => {
    setWorkbenchContext({
      sourceTitle: selectedVisibleNode ? String(selectedVisibleNode.data.label) : '知识图谱节点',
      actionType: 'review',
      courseTitle: 'Knowledge Graph',
      sourceType: 'manual',
      createdAt: new Date().toISOString(),
    })
    navigate('/workbench')
  }

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredNodes = normalizedSearch.length > 0
    ? nodes.filter(node => {
      const referenceIds = node.data.referenceIds.join(' ')
      return [
        node.data.label,
        node.data.description,
        referenceIds,
      ].join(' ').toLowerCase().includes(normalizedSearch)
    })
    : nodes
  const visibleNodeIds = new Set(filteredNodes.map(node => node.id))
  const filteredEdges = edges.filter(edge => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
  const selectedVisibleNode = filteredNodes.find(node => node.id === selectedNode?.id) ?? filteredNodes[0] ?? null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex shrink-0 flex-col gap-4 border-b border-scholar-border bg-white px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-scholar-primary">
            <Network size={18} />
            知识关系
          </div>
          <h1 className="text-2xl font-bold text-scholar-text-primary">知识图谱</h1>
          <p className="mt-2 text-sm text-scholar-text-secondary">在同一研究工作区内查看概念、文献和研究空白的关系。</p>
        </div>
        <Tabs items={graphTabs} value={activeTab} onChange={setActiveTab} />
      </header>

      <div className="grid min-h-0 flex-1 gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-h-0 p-0">
          <div className="flex h-full min-h-[560px] flex-col">
            <div className="border-b border-scholar-border p-4">
              <div className="relative max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-scholar-text-weak" size={16} />
                <input
                  type="text"
                  placeholder="搜索概念、学者或文献节点..."
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  className="w-full rounded-xl border border-scholar-border bg-scholar-bg-canvas py-2.5 pl-11 pr-4 text-sm font-medium text-scholar-text-primary outline-none transition focus:border-scholar-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-scholar-bg-canvas">
              {isLoading && (
                <div className="flex h-full items-center justify-center p-6">
                  <StateBlock title="正在加载知识图谱..." icon={<Network size={22} />} />
                </div>
              )}
              {!isLoading && errorMessage && (
                <div className="flex h-full items-center justify-center p-6">
                  <StateBlock title="知识图谱加载失败" description={errorMessage} icon={<Network size={22} />} />
                </div>
              )}
              {!isLoading && !errorMessage && nodes.length === 0 && (
                <div className="flex h-full items-center justify-center p-6">
                  <StateBlock title="暂无图谱数据" description="启用本地 RAG 图谱或打开研究空间后，这里会展示概念、文献和研究空白关系。" icon={<Network size={22} />} />
                </div>
              )}
              {!isLoading && !errorMessage && nodes.length > 0 && filteredNodes.length === 0 && (
                <div className="flex h-full items-center justify-center p-6">
                  <StateBlock title="未找到匹配节点" description="换一个概念、说明词或引用编号继续搜索。" icon={<Search size={22} />} />
                </div>
              )}
              {!isLoading && !errorMessage && filteredNodes.length > 0 && (
                <ReactFlow
                  nodes={filteredNodes}
                  edges={filteredEdges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={(_, node) => setSelectedNode(node)}
                  fitView
                  attributionPosition="bottom-left"
                >
                  <Background color="#dee0e3" gap={20} size={1} />
                  <Controls position="bottom-right" className="shadow-sm border-scholar-border" />
                </ReactFlow>
              )}
            </div>
          </div>
        </Card>

        <Card title="节点详情" className="min-h-0 overflow-y-auto">
          {selectedVisibleNode ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-scholar-discovery">{selectedVisibleNode.data.nodeType} Node</span>
                  <h2 className="mt-1 text-lg font-bold leading-tight text-scholar-text-primary">{selectedVisibleNode.data.label as string}</h2>
                </div>
                <button type="button" onClick={() => setSelectedNode(null)} className="rounded-lg p-1 text-scholar-text-weak hover:bg-gray-100" aria-label="关闭节点详情">
                  <X size={18} />
                </button>
              </div>

              <section>
                <h3 className="text-sm font-semibold text-scholar-text-primary">节点说明</h3>
                <p className="mt-2 text-sm leading-6 text-scholar-text-secondary">
                  {selectedVisibleNode.data.description || '该节点暂无说明，后续会随 RAG 图谱或研究空间材料补齐。'}
                </p>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-scholar-text-primary">关联证据</h3>
                <div className="mt-3 space-y-2">
                  {selectedVisibleNode.data.referenceIds.length > 0 ? (
                    selectedVisibleNode.data.referenceIds.map(referenceId => (
                      <div key={referenceId} className="rounded-xl border border-scholar-border bg-scholar-bg-canvas p-3">
                        <h4 className="text-sm font-semibold leading-tight text-scholar-text-primary">{referenceId}</h4>
                        <p className="mt-1 text-xs font-medium text-scholar-text-weak">来自图谱节点引用</p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-scholar-border bg-scholar-bg-canvas p-3 text-xs font-medium text-scholar-text-weak">
                      暂无直接关联引用。
                    </p>
                  )}
                </div>
              </section>

              <Button onClick={handleTakeToWorkbench} className="w-full">
                加入工作台进行综述
                <ChevronRight size={16} />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-scholar-text-secondary">选择一个节点查看关联文献与可写入工作台的上下文。</p>
          )}
        </Card>
      </div>
    </div>
  )
}
