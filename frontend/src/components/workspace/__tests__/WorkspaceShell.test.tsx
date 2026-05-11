import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MouseEvent, ReactNode } from 'react'
import { createJSONStorage } from 'zustand/middleware'
import App from '../../../App'
import { useUserStore } from '../../../store/user'
import { useWorkspaceStore } from '../../../store/workspace'

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

describe('WorkspaceShell routes', () => {
  beforeEach(() => {
    installMemoryStorage()
    window.history.pushState({}, '', '/workbench')
    useUserStore.setState({ token: 'token-1', userId: 'alex@hust.edu.cn' })
    useWorkspaceStore.getState().resetWorkspace()
  })

  it('renders workbench inside the same global workspace shell as the rest of the app', () => {
    render(<App />)

    const shell = screen.getByTestId('workspace-shell')
    expect(within(shell).getByText('ScholarScript')).toBeInTheDocument()

    const nav = within(shell).getByRole('navigation', { name: '全局导航' })
    expect(within(nav).getByRole('link', { name: /总览/ })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: /课程/ })).toHaveAttribute('href', '/courses')
    expect(within(nav).getByRole('link', { name: /学术工作台/ })).toHaveAttribute('href', '/workbench')
    expect(within(nav).getByRole('link', { name: /知识图谱/ })).toHaveAttribute('href', '/discovery')

    expect(within(shell).getByRole('heading', { name: '基于深度学习的图像分类方法综述' })).toBeInTheDocument()
    expect(screen.getByTestId('knowledge-flow')).toBeInTheDocument()
  })
})
