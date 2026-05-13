import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MouseEvent, ReactNode } from 'react'
import { createJSONStorage } from 'zustand/middleware'
import App from '../../App'
import { useLayoutStore } from '../../store/layout'
import { useUserStore } from '../../store/user'
import { useWorkspaceStore } from '../../store/workspace'

const fetchResearchSpaces = vi.hoisted(() => vi.fn())
const openResearchSpace = vi.hoisted(() => vi.fn())

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

describe('course to workbench handoff', () => {
  beforeEach(() => {
    installMemoryStorage()
    fetchResearchSpaces.mockReset()
    openResearchSpace.mockReset()
    fetchResearchSpaces.mockResolvedValue({
      items: [{
        id: 'microeconomics-llm-education',
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
    openResearchSpace.mockResolvedValue({
      context: {
        sourceTitle: 'Theory of the Firm',
        actionType: 'outline',
        courseTitle: 'Principles of Microeconomics',
        sourceType: 'lecture',
        createdAt: '2026-05-13T00:00:00.000Z',
      },
    })
    window.history.pushState({}, '', '/courses')
    useUserStore.setState({ token: 'token-1', userId: 'alex@hust.edu.cn' })
    useLayoutStore.setState({ workbenchContext: null, isRightPanelOpen: false })
    useWorkspaceStore.getState().resetWorkspace()
  })

  it('opens workbench with the selected course material visible in context and AI input', async () => {
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /载入工作台剖析/i }))

    await waitFor(() => {
      expect(window.location.pathname).toBe('/workbench')
    })

    expect(await screen.findByText('Theory of the Firm')).toBeInTheDocument()
    expect(screen.getByText(/当前研究上下文/)).toBeInTheDocument()
    expect(await screen.findByPlaceholderText(/Theory of the Firm/)).toBeInTheDocument()
  })
})
