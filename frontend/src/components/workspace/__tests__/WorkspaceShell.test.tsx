import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MouseEvent, ReactNode } from 'react'
import { createJSONStorage } from 'zustand/middleware'
import App from '../../../App'
import { useUserStore } from '../../../store/user'
import { useWorkspaceStore } from '../../../store/workspace'

const fetchSessions = vi.hoisted(() => vi.fn())
const fetchSessionMessages = vi.hoisted(() => vi.fn())
const fetchSessionArtifact = vi.hoisted(() => vi.fn())
const deleteSession = vi.hoisted(() => vi.fn())
const fetchProfile = vi.hoisted(() => vi.fn())

vi.mock('../../../api/sessions', () => ({
  fetchSessions: (...args: unknown[]) => fetchSessions(...args),
  fetchSessionMessages: (...args: unknown[]) => fetchSessionMessages(...args),
  fetchSessionArtifact: (...args: unknown[]) => fetchSessionArtifact(...args),
  deleteSession: (...args: unknown[]) => deleteSession(...args),
  fetchProfile: (...args: unknown[]) => fetchProfile(...args),
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

describe('WorkspaceShell routes', () => {
  beforeEach(() => {
    installMemoryStorage()
    window.history.pushState({}, '', '/workbench')
    useUserStore.setState({ token: 'token-1', userId: 'alex@hust.edu.cn' })
    useWorkspaceStore.getState().resetWorkspace()
    fetchSessions.mockResolvedValue({
      total: 1,
      items: [{
        session_id: 'sess-shell-restore',
        title: '课程文献综述恢复',
        scene: 'norms',
        updated_at: 1778510000,
        message_count: 2,
      }],
    })
    fetchSessionMessages.mockResolvedValue({
      messages: [
        { role: 'user', content: '恢复课程材料' },
        { role: 'assistant', content: '建议按背景、方法、证据组织。' },
      ],
    })
    fetchSessionArtifact.mockResolvedValue({
      papers: [{ id: 'paper-shell', title: 'Shell Restore Paper', year: 2026, score: 0.91 }],
      gaps: [{ id: 'gap-shell', description: '缺少规范证据', severity: 'high', addressed_by: 0, score: 0.8 }],
      final_outline: '一、课程背景\n二、规范证据',
    })
    deleteSession.mockResolvedValue({ deleted: true })
    fetchProfile.mockResolvedValue({
      teaching_style: 'step_by_step',
      feedback_verbosity: 'balanced',
      writing_stage: '正在写第一篇',
      major: 'CS',
      weak_points: {},
      total_sessions: 1,
      last_session_at: 1778510000,
    })
  })

  it('renders workbench inside the same global workspace shell as the rest of the app', () => {
    render(<App />)

    const shell = screen.getByTestId('workspace-shell')
    expect(within(shell).getByText('ScholarScript')).toBeInTheDocument()

    const nav = within(shell).getByRole('navigation', { name: '全局导航' })
    expect(within(nav).getByRole('link', { name: /总览/ })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: /课程/ })).toHaveAttribute('href', '/courses')
    expect(within(nav).getByRole('link', { name: /学术工作台/ })).toHaveAttribute('href', '/workbench')
    expect(within(nav).getByRole('link', { name: /文献库/ })).toHaveAttribute('href', '/library')
    expect(within(nav).getByRole('link', { name: /知识图谱/ })).toHaveAttribute('href', '/graph')

    expect(within(shell).getByRole('heading', { name: '基于深度学习的图像分类方法综述' })).toBeInTheDocument()
    expect(screen.getByTestId('knowledge-flow')).toBeInTheDocument()
  })

  it('provides mobile bottom navigation for small screens', () => {
    render(<App />)

    const mobileNav = screen.getByRole('navigation', { name: '移动导航' })
    expect(within(mobileNav).getByRole('link', { name: /总览/ })).toHaveAttribute('href', '/')
    expect(within(mobileNav).getByRole('link', { name: /工作台/ })).toHaveAttribute('href', '/workbench')
    expect(within(mobileNav).getByRole('link', { name: /写作/ })).toHaveAttribute('href', '/writing')
  })

  it('restores a history session from the unified right panel into workbench state', async () => {
    window.history.pushState({}, '', '/courses')

    render(<App />)

    screen.getByRole('button', { name: '历史记录' }).click()
    expect(await screen.findByText('课程文献综述恢复')).toBeInTheDocument()

    screen.getByText('课程文献综述恢复').click()

    expect(await screen.findByText(/已完整恢复历史会话/)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/workbench')
    expect(useWorkspaceStore.getState().activeSessionId).toBe('sess-shell-restore')
    expect(useWorkspaceStore.getState().documentBlocks.some(block => block.content.includes('课程背景'))).toBe(true)
  })
})
