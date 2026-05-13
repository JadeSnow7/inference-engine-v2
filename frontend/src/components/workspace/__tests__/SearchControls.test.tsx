import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import { GlobalTopBar } from '../GlobalTopBar'
import { LeftSidebar } from '../../../features/workspace/LeftSidebar'
import { TopBar } from '../../../features/workspace/TopBar'
import { useUserStore } from '../../../store/user'
import { useWorkspaceStore } from '../../../store/workspace'

const searchItems = vi.hoisted(() => vi.fn())

vi.mock('../../../api/search', () => ({
  searchItems: (...args: unknown[]) => searchItems(...args),
}))

function renderWithRouter(node: ReactNode) {
  render(<BrowserRouter>{node}</BrowserRouter>)
}

function installMemoryStorage() {
  const values = new Map<string, string>()
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
  vi.stubGlobal('localStorage', localStorage)
  useUserStore.persist.setOptions({ storage: createJSONStorage(() => localStorage) })
}

describe('workspace search controls', () => {
  beforeEach(() => {
    installMemoryStorage()
    searchItems.mockReset()
    searchItems.mockResolvedValue({
      items: [{
        id: 'document:doc-1',
        type: 'document',
        title: 'LLM Education Review',
        excerpt: 'Matched document',
        target: '/workbench?document=doc-1',
        meta: '文档',
      }],
    })
    useUserStore.setState({ token: 'token-1', userId: 'alex@hust.edu.cn' })
    useWorkspaceStore.getState().resetWorkspace()
  })

  it('enables global search and renders API results', async () => {
    renderWithRouter(<GlobalTopBar />)

    fireEvent.change(screen.getByLabelText('全局搜索'), { target: { value: 'LLM' } })

    expect(await screen.findByText('LLM Education Review')).toBeInTheDocument()
    expect(searchItems).toHaveBeenLastCalledWith({ q: 'LLM', scope: 'global' })
  })

  it('shows an empty state when search has no matches', async () => {
    searchItems.mockResolvedValue({ items: [] })

    renderWithRouter(<GlobalTopBar />)

    fireEvent.change(screen.getByLabelText('全局搜索'), { target: { value: 'missing' } })

    expect(await screen.findByText('未找到匹配结果')).toBeInTheDocument()
  })

  it('shows an error state when search fails', async () => {
    searchItems.mockRejectedValue(new Error('search unavailable'))

    renderWithRouter(<GlobalTopBar />)

    fireEvent.change(screen.getByLabelText('全局搜索'), { target: { value: 'LLM' } })

    expect(await screen.findByText('search unavailable')).toBeInTheDocument()
  })

  it('enables workspace search from the workbench top bar', async () => {
    renderWithRouter(<TopBar />)

    fireEvent.change(screen.getByLabelText('工作台搜索'), { target: { value: 'LLM' } })

    expect(await screen.findByText('LLM Education Review')).toBeInTheDocument()
    expect(searchItems).toHaveBeenLastCalledWith({ q: 'LLM', scope: 'workspace' })
  })

  it('enables conversation search from the left sidebar', async () => {
    searchItems.mockResolvedValue({
      items: [{
        id: 'conversation:session-1',
        type: 'conversation',
        title: 'LLM feedback discussion',
        excerpt: 'review · 4 条消息',
        target: '/workbench?session=session-1',
        meta: '会话',
      }],
    })

    renderWithRouter(<LeftSidebar />)

    fireEvent.change(screen.getByLabelText('对话搜索'), { target: { value: 'LLM' } })

    expect(await screen.findByText('LLM feedback discussion')).toBeInTheDocument()
    expect(searchItems).toHaveBeenLastCalledWith({ q: 'LLM', scope: 'conversations' })
  })
})
