import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MouseEvent, ReactNode } from 'react'
import { createJSONStorage } from 'zustand/middleware'
import App from '../../App'
import { aiSuggestion } from '../../mocks/workspaceMock'
import { useUserStore } from '../../store/user'
import { useWorkspaceStore } from '../../store/workspace'

const fetchDashboardSummary = vi.hoisted(() => vi.fn())
const fetchEvidence = vi.hoisted(() => vi.fn())
const fetchGraph = vi.hoisted(() => vi.fn())
const fetchResearchSpaces = vi.hoisted(() => vi.fn())
const openResearchSpace = vi.hoisted(() => vi.fn())

vi.mock('../../api/dashboard', () => ({
  fetchDashboardSummary: (...args: unknown[]) => fetchDashboardSummary(...args),
}))

vi.mock('../../api/graph', () => ({
  fetchGraph: (...args: unknown[]) => fetchGraph(...args),
}))

vi.mock('../../api/library', () => ({
  fetchEvidence: (...args: unknown[]) => fetchEvidence(...args),
}))

vi.mock('../../api/courses', () => ({
  fetchResearchSpaces: (...args: unknown[]) => fetchResearchSpaces(...args),
  openResearchSpace: (...args: unknown[]) => openResearchSpace(...args),
}))

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({
    nodes,
    onNodeClick,
    children,
  }: {
    nodes: Array<{ id: string; data: { label: string } }>
    onNodeClick?: (event: MouseEvent, node: { id: string; data: { label: string } }) => void
    children?: ReactNode
  }) => (
    <div data-testid="knowledge-flow">
      {nodes.map(node => (
        <button key={node.id} type="button" onClick={(event) => onNodeClick?.(event, node)}>
          {node.data.label}
        </button>
      ))}
      {children}
    </div>
  ),
  Background: () => <div data-testid="flow-background" />,
  Controls: () => <div data-testid="flow-controls" />,
}))

function installMemoryStorage() {
  const values = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  vi.stubGlobal('localStorage', localStorage)
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(`session:${key}`) ?? null,
    setItem: (key: string, value: string) => { values.set(`session:${key}`, value) },
    removeItem: (key: string) => { values.delete(`session:${key}`) },
  })
  useUserStore.persist.setOptions({ storage: createJSONStorage(() => localStorage) })
}

describe('workspace views', () => {
  beforeEach(() => {
    installMemoryStorage()
    fetchDashboardSummary.mockReset()
    fetchEvidence.mockReset()
    fetchGraph.mockReset()
    fetchResearchSpaces.mockReset()
    openResearchSpace.mockReset()
    fetchDashboardSummary.mockResolvedValue({
      metrics: {
        documentBlocks: 6,
        evidenceSources: 5,
        graphUpdates: 12,
        normReminders: 3,
      },
      focus: {
        title: '大语言模型在教育领域的应用综述',
        summary: '当前重点是补齐规范证据。',
        tags: ['进行中', '教育技术', '论文综述'],
      },
      tasks: [{ id: 'task-1', title: '补全文献综述中的教育场景证据', meta: '工作台 · 2 个待处理修改', target: '/workbench' }],
      recentCourses: [{ id: 'course-1', title: 'Research Methods in Education', meta: '研究主题：LLM 课堂反馈 · 18 篇文献' }],
      recentDocuments: [{ id: 'doc-1', title: 'LLM-in-Education-review.md', meta: '综述草稿 · 今天 09:24' }],
    })
    fetchResearchSpaces.mockResolvedValue({
      items: [{
        id: 'space-1',
        title: 'Principles of Microeconomics',
        teacher: 'Prof. John Doe',
        topic: '大语言模型在教育领域的应用综述',
        literatureCount: 24,
        graphUpdates: 5,
        status: '正在撰写文献综述',
        material: {
          title: 'Theory of the Firm',
          type: 'outline',
          sourceType: 'lecture',
        },
      }],
    })
    fetchEvidence.mockResolvedValue({ items: [] })
    fetchGraph.mockResolvedValue({
      nodes: [{
        id: 'graph-api-topic',
        label: 'API Graph Topic',
        type: 'concept',
        description: 'Graph data loaded from API.',
        referenceIds: [],
        position: { x: 80, y: 80 },
      }],
      edges: [],
    })
    useUserStore.setState({ token: 'token-1', userId: 'alex@hust.edu.cn' })
    useWorkspaceStore.getState().resetWorkspace()
  })

  it('renders the dashboard as a research workspace home', async () => {
    window.history.pushState({}, '', '/')

    render(<App />)

    expect(screen.getByRole('heading', { name: '写作工作台总览' })).toBeInTheDocument()
    expect(await screen.findByText('当前研究焦点')).toBeInTheDocument()
    expect(screen.getByText('AI 建议')).toBeInTheDocument()
    expect(screen.queryByText(/Welcome Back/i)).not.toBeInTheDocument()
  })

  it('exposes library and writing as first-class workspace routes', () => {
    window.history.pushState({}, '', '/library')

    render(<App />)

    const nav = screen.getByRole('navigation', { name: '全局导航' })
    expect(within(nav).getByRole('link', { name: /文献库/ })).toHaveAttribute('href', '/library')
    expect(within(nav).getByRole('link', { name: /AI 写作/ })).toHaveAttribute('href', '/writing')
    expect(screen.getByRole('heading', { name: '文献库' })).toBeInTheDocument()
    expect(screen.getByText('证据库')).toBeInTheDocument()
  })

  it('renders courses as research-space entry cards', async () => {
    window.history.pushState({}, '', '/courses')

    render(<App />)

    expect(screen.getByRole('heading', { name: '研究空间' })).toBeInTheDocument()
    expect(await screen.findByText('大语言模型在教育领域的应用综述')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /打开空白工作台/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /进入研究工作台/ })).not.toBeInTheDocument()
  })

  it('keeps discovery inside the workspace page model', async () => {
    window.history.pushState({}, '', '/graph')

    render(<App />)

    expect(screen.getByRole('heading', { name: '知识图谱' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('搜索概念、学者或文献节点...')).toBeInTheDocument()
    expect(await screen.findByTestId('knowledge-flow')).toBeInTheDocument()
    expect(screen.getAllByText('API Graph Topic').length).toBeGreaterThan(0)
  })

  it('renders the workspace context drawer tabs', async () => {
    window.history.pushState({}, '', '/workbench')

    render(<App />)

    expect(screen.getByRole('tab', { name: '审阅' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '证据' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '图谱' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '版本' })).toBeInTheDocument()
    expect(screen.getByText('暂无待处理审阅项')).toBeInTheDocument()
  })

  it('keeps generated AI suggestions reviewable and applicable in the drawer', () => {
    window.history.pushState({}, '', '/workbench')
    useWorkspaceStore.getState().setCurrentSuggestion(aiSuggestion)

    render(<App />)

    const drawer = screen.getByRole('complementary', { name: '工作台上下文' })
    expect(within(drawer).getByRole('button', { name: '接受全部' })).toBeInTheDocument()
    expect(within(drawer).getByRole('button', { name: '接受当前' })).toBeInTheDocument()
    expect(within(drawer).getByText('对比视图')).toBeInTheDocument()
  })

  it('limits evidence drawer results to the selected block citations', () => {
    window.history.pushState({}, '', '/workbench')
    useWorkspaceStore.getState().setSelectedBlock('block-intro-1')
    useWorkspaceStore.getState().setRightPanelMode('evidence')

    render(<App />)

    const drawer = screen.getByRole('complementary', { name: '工作台上下文' })
    expect(within(drawer).getByText('AlexNet: Image Classification with Deep Convolutional Neural Networks')).toBeInTheDocument()
    expect(within(drawer).queryByText('Deep Residual Learning for Image Recognition')).not.toBeInTheDocument()
  })
})
