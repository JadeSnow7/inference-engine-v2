import { useState, useCallback } from 'react';
import { Search, ChevronRight, X } from 'lucide-react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import type { Node, Edge, NodeChange, EdgeChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes: Node[] = [
  { id: '1', position: { x: 250, y: 100 }, data: { label: 'Generative AI' }, type: 'input', className: 'min-w-[150px] shadow-sm border-2 border-scholar-discovery/50 bg-white rounded-lg text-sm font-semibold p-3 text-center text-scholar-text-primary' },
  { id: '2', position: { x: 100, y: 250 }, data: { label: 'Large Language Models (LLMs)' }, className: 'min-w-[150px] shadow-md border-2 border-scholar-discovery bg-purple-50 rounded-lg text-sm font-bold p-3 text-center text-scholar-discovery' },
  { id: '3', position: { x: 400, y: 250 }, data: { label: 'Diffusion Models' }, className: 'min-w-[150px] shadow-sm border border-scholar-border bg-white rounded-lg text-sm font-medium p-3 text-center text-scholar-text-primary' },
  { id: '4', position: { x: -50, y: 400 }, data: { label: 'Zero-shot Learning' }, className: 'min-w-[150px] shadow-sm border border-scholar-border bg-white rounded-lg text-sm font-medium p-3 text-center text-scholar-text-secondary' },
  { id: '5', position: { x: 250, y: 400 }, data: { label: 'Transformer Architecture' }, className: 'min-w-[150px] shadow-sm border border-scholar-border bg-white rounded-lg text-sm font-medium p-3 text-center text-scholar-text-secondary' },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#7b2cbf', strokeWidth: 2 } },
  { id: 'e1-3', source: '1', target: '3', style: { stroke: '#dee0e3', strokeWidth: 1.5 } },
  { id: 'e2-4', source: '2', target: '4', label: 'emergent ability', labelStyle: { fill: '#646a73', fontSize: 10 }, style: { stroke: '#dee0e3', strokeWidth: 1.5 } },
  { id: 'e2-5', source: '2', target: '5', label: 'based on', labelStyle: { fill: '#646a73', fontSize: 10 }, style: { stroke: '#dee0e3', strokeWidth: 1.5 } },
];

export default function Discovery() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  };

  return (
    <div className="flex w-full h-full bg-scholar-bg-canvas relative overflow-hidden">

      <div className="flex-1 flex flex-col relative w-full h-full">
        <header className="absolute top-0 left-0 w-full h-16 flex items-center justify-center p-4 z-10 pointer-events-none">
          <div className="relative w-full max-w-md pointer-events-auto shadow-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-scholar-text-weak" size={16} />
            <input
              type="text"
              placeholder="搜索概念、学者或文献节点..."
              className="w-full bg-white/90 backdrop-blur-md border border-scholar-border rounded-full py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-scholar-primary focus:ring-2 focus:ring-scholar-primary/20 transition-all font-medium text-scholar-text-primary"
            />
          </div>
        </header>

        <div className="w-full h-full bg-scholar-bg-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            fitView
            attributionPosition="bottom-left"
          >
            <Background color="#dee0e3" gap={20} size={1} />
            <Controls position="bottom-right" className="shadow-sm border-scholar-border" />
          </ReactFlow>
        </div>
      </div>

      {selectedNode && (
        <aside className="absolute right-0 top-0 h-full w-80 bg-scholar-bg-surface border-l border-scholar-border shadow-[-4px_0_24px_rgba(0,0,0,0.05)] z-20 flex flex-col animate-in slide-in-from-right-10 duration-300">

          <div className="p-4 border-b border-scholar-border flex justify-between items-start bg-gray-50/50">
            <div>
              <span className="text-[10px] font-bold text-scholar-discovery uppercase tracking-wider mb-1 block">Concept Node</span>
              <h3 className="font-bold text-lg text-scholar-text-primary leading-tight">{selectedNode.data.label as string}</h3>
            </div>
            <button onClick={() => setSelectedNode(null)} className="p-1 rounded-md text-scholar-text-weak hover:bg-gray-200 mt-1">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <section>
              <h4 className="text-sm font-semibold text-scholar-text-primary mb-2">Definition</h4>
              <p className="text-sm text-scholar-text-secondary leading-relaxed">
                A class of foundation models trained on massive amounts of text data that are capable of understanding and generating human language. They utilize transformer architectures to predict the next token or masked tokens.
              </p>
            </section>

            <section>
              <h4 className="text-sm font-semibold text-scholar-text-primary mb-3">Key Literature (4)</h4>
              <div className="space-y-2">
                <LiteratureCard name="Attention Is All You Need" author="Vaswani et al." year="2017" />
                <LiteratureCard name="Language Models are Few-Shot Learners" author="Brown et al." year="2020" />
                <LiteratureCard name="Scaling Laws for Neural Language Models" author="Kaplan et al." year="2020" />
              </div>
            </section>
          </div>

          <div className="p-4 border-t border-scholar-border bg-white mt-auto">
            <button className="w-full flex items-center justify-center space-x-2 py-2.5 bg-scholar-primary text-white rounded-lg text-sm font-medium hover:bg-scholar-primary-hover shadow-sm transition-colors">
              <span>加入工作台进行综述</span>
              <ChevronRight size={16} />
            </button>
          </div>

        </aside>
      )}

    </div>
  );
}

function LiteratureCard({ name, author, year }: { name: string; author: string; year: string }) {
  return (
    <div className="p-2.5 border border-scholar-border rounded-lg bg-scholar-bg-canvas hover:border-scholar-primary/40 cursor-pointer transition-colors">
      <h5 className="text-sm font-medium text-scholar-text-primary leading-tight mb-1">{name}</h5>
      <p className="text-[11px] text-scholar-text-weak font-medium">{author} · {year}</p>
    </div>
  );
}
