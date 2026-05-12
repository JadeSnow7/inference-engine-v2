import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MouseEvent, ReactNode } from 'react'
import { createJSONStorage } from 'zustand/middleware'
import App from '../../App'
import { useUserStore } from '../../store/user'
import { useWorkspaceStore } from '../../store/workspace'

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
    useUserStore.setState({ token: 'token-1', userId: 'alex@hust.edu.cn' })
    useWorkspaceStore.getState().resetWorkspace()
  })

  it('renders the dashboard as a research workspace home', () => {
    window.history.pushState({}, '', '/')

    render(<App />)

    expect(screen.getByRole('heading', { name: '研究工作台总览' })).toBeInTheDocument()
    expect(screen.getByText('当前研究焦点')).toBeInTheDocument()
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

  it('renders courses as research-space entry cards', () => {
    window.history.pushState({}, '', '/courses')

    render(<App />)

    expect(screen.getByRole('heading', { name: '研究空间' })).toBeInTheDocument()
    expect(screen.getByText('大语言模型在教育领域的应用综述')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /进入研究工作台/ })).toBeInTheDocument()
  })

  it('keeps discovery inside the workspace page model', () => {
    window.history.pushState({}, '', '/graph')

    render(<App />)

    expect(screen.getByRole('heading', { name: '知识图谱' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('搜索概念、学者或文献节点...')).toBeInTheDocument()
    expect(screen.getByTestId('knowledge-flow')).toBeInTheDocument()
  })
})
