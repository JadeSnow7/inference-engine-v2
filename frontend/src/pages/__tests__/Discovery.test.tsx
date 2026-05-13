import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Discovery from '../Discovery'

const fetchGraph = vi.hoisted(() => vi.fn())

vi.mock('../../api/graph', () => ({
  fetchGraph: (...args: unknown[]) => fetchGraph(...args),
}))

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({
    nodes,
    children,
  }: {
    nodes: Array<{ id: string; data: { label: string } }>
    children?: ReactNode
  }) => (
    <div data-testid="knowledge-flow">
      {nodes.map(node => (
        <div key={node.id}>{node.data.label}</div>
      ))}
      {children}
    </div>
  ),
  Background: () => <div data-testid="flow-background" />,
  Controls: () => <div data-testid="flow-controls" />,
  applyNodeChanges: (_changes: unknown, nodes: unknown) => nodes,
  applyEdgeChanges: (_changes: unknown, edges: unknown) => edges,
}))

function renderDiscovery() {
  render(
    <BrowserRouter>
      <Discovery />
    </BrowserRouter>,
  )
}

describe('Discovery graph API data', () => {
  beforeEach(() => {
    fetchGraph.mockReset()
  })

  it('loads graph nodes from the graph API without static fallback data', async () => {
    fetchGraph.mockResolvedValue({
      nodes: [{
        id: 'api-topic',
        label: 'API Topic',
        type: 'concept',
        description: 'Loaded from backend graph.',
        referenceIds: [],
        position: { x: 100, y: 120 },
      }],
      edges: [],
    })

    renderDiscovery()

    expect(screen.getByText('正在加载知识图谱...')).toBeInTheDocument()
    expect(await screen.findAllByText('API Topic')).toHaveLength(2)
    expect(screen.queryByText('Generative AI')).not.toBeInTheDocument()
  })

  it('shows an empty state when the graph API returns no nodes', async () => {
    fetchGraph.mockResolvedValue({ nodes: [], edges: [] })

    renderDiscovery()

    expect(await screen.findByText('暂无图谱数据')).toBeInTheDocument()
    expect(screen.getByText('启用本地 RAG 图谱或打开研究空间后，这里会展示概念、文献和研究空白关系。')).toBeInTheDocument()
  })

  it('shows an error state when graph loading fails', async () => {
    fetchGraph.mockRejectedValue(new Error('graph unavailable'))

    renderDiscovery()

    expect(await screen.findByText('知识图谱加载失败')).toBeInTheDocument()
    expect(screen.getByText('graph unavailable')).toBeInTheDocument()
  })
})
