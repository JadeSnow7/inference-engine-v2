import { useCallback, useState } from 'react'
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
import { Button, Card, Tabs } from '../components/ui'
import { useLayoutStore } from '../store/layout'

const initialNodes: Node[] = [
  { id: '1', position: { x: 250, y: 100 }, data: { label: 'Generative AI' }, type: 'input', className: 'min-w-[150px] shadow-sm border-2 border-scholar-discovery/50 bg-white rounded-lg text-sm font-semibold p-3 text-center text-scholar-text-primary' },
  { id: '2', position: { x: 100, y: 250 }, data: { label: 'Large Language Models (LLMs)' }, className: 'min-w-[150px] shadow-md border-2 border-scholar-discovery bg-purple-50 rounded-lg text-sm font-bold p-3 text-center text-scholar-discovery' },
  { id: '3', position: { x: 400, y: 250 }, data: { label: 'Diffusion Models' }, className: 'min-w-[150px] shadow-sm border border-scholar-border bg-white rounded-lg text-sm font-medium p-3 text-center text-scholar-text-primary' },
  { id: '4', position: { x: -50, y: 400 }, data: { label: 'Zero-shot Learning' }, className: 'min-w-[150px] shadow-sm border border-scholar-border bg-white rounded-lg text-sm font-medium p-3 text-center text-scholar-text-secondary' },
  { id: '5', position: { x: 250, y: 400 }, data: { label: 'Transformer Architecture' }, className: 'min-w-[150px] shadow-sm border border-scholar-border bg-white rounded-lg text-sm font-medium p-3 text-center text-scholar-text-secondary' },
]

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#7b2cbf', strokeWidth: 2 } },
  { id: 'e1-3', source: '1', target: '3', style: { stroke: '#dee0e3', strokeWidth: 1.5 } },
  { id: 'e2-4', source: '2', target: '4', label: 'emergent ability', labelStyle: { fill: '#646a73', fontSize: 10 }, style: { stroke: '#dee0e3', strokeWidth: 1.5 } },
  { id: 'e2-5', source: '2', target: '5', label: 'based on', labelStyle: { fill: '#646a73', fontSize: 10 }, style: { stroke: '#dee0e3', strokeWidth: 1.5 } },
]

const graphTabs = [
  { id: 'topic', label: '主题图谱' },
  { id: 'paper', label: '文献关系' },
  { id: 'gap', label: '研究空白' },
]

export default function Discovery() {
  const navigate = useNavigate()
  const setWorkbenchContext = useLayoutStore(state => state.setWorkbenchContext)
  const [nodes, setNodes] = useState<Node[]>(initialNodes)
  const [edges, setEdges] = useState<Edge[]>(initialEdges)
  const [activeTab, setActiveTab] = useState('topic')
  const [selectedNode, setSelectedNode] = useState<Node | null>(initialNodes[1])

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => setNodes(nds => applyNodeChanges(changes, nds)),
    [],
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => setEdges(eds => applyEdgeChanges(changes, eds)),
    [],
  )

  const handleTakeToWorkbench = () => {
    setWorkbenchContext({
      sourceTitle: selectedNode ? String(selectedNode.data.label) : '知识图谱节点',
      actionType: 'review',
      courseTitle: 'Knowledge Graph',
      sourceType: 'manual',
      createdAt: new Date().toISOString(),
    })
    navigate('/workbench')
  }

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
                  className="w-full rounded-xl border border-scholar-border bg-scholar-bg-canvas py-2.5 pl-11 pr-4 text-sm font-medium text-scholar-text-primary outline-none transition focus:border-scholar-primary focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-scholar-bg-canvas">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => setSelectedNode(node)}
                fitView
                attributionPosition="bottom-left"
              >
                <Background color="#dee0e3" gap={20} size={1} />
                <Controls position="bottom-right" className="shadow-sm border-scholar-border" />
              </ReactFlow>
            </div>
          </div>
        </Card>

        <Card title="节点详情" className="min-h-0 overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-scholar-discovery">Concept Node</span>
                  <h2 className="mt-1 text-lg font-bold leading-tight text-scholar-text-primary">{selectedNode.data.label as string}</h2>
                </div>
                <button type="button" onClick={() => setSelectedNode(null)} className="rounded-lg p-1 text-scholar-text-weak hover:bg-gray-100" aria-label="关闭节点详情">
                  <X size={18} />
                </button>
              </div>

              <section>
                <h3 className="text-sm font-semibold text-scholar-text-primary">Definition</h3>
                <p className="mt-2 text-sm leading-6 text-scholar-text-secondary">
                  Foundation model concepts and education-domain evidence are linked here so writing, literature review and graph exploration share the same context.
                </p>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-scholar-text-primary">Key Literature</h3>
                <div className="mt-3 space-y-2">
                  <LiteratureCard name="Attention Is All You Need" author="Vaswani et al." year="2017" />
                  <LiteratureCard name="Language Models are Few-Shot Learners" author="Brown et al." year="2020" />
                  <LiteratureCard name="Scaling Laws for Neural Language Models" author="Kaplan et al." year="2020" />
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

function LiteratureCard({ name, author, year }: { name: string; author: string; year: string }) {
  return (
    <div className="rounded-xl border border-scholar-border bg-scholar-bg-canvas p-3">
      <h4 className="text-sm font-semibold leading-tight text-scholar-text-primary">{name}</h4>
      <p className="mt-1 text-xs font-medium text-scholar-text-weak">{author} · {year}</p>
    </div>
  )
}
