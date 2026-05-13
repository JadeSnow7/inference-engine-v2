import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from '../Dashboard'

const fetchDashboardSummary = vi.hoisted(() => vi.fn())

vi.mock('../../api/dashboard', () => ({
  fetchDashboardSummary: (...args: unknown[]) => fetchDashboardSummary(...args),
}))

function renderDashboard() {
  render(
    <BrowserRouter>
      <Dashboard />
    </BrowserRouter>,
  )
}

describe('Dashboard API summary', () => {
  beforeEach(() => {
    fetchDashboardSummary.mockReset()
  })

  it('renders metrics tasks courses and documents from the dashboard API', async () => {
    fetchDashboardSummary.mockResolvedValue({
      metrics: {
        documentBlocks: 8,
        evidenceSources: 13,
        graphUpdates: 5,
        normReminders: 2,
      },
      focus: {
        title: 'API research focus',
        summary: 'API focus summary.',
        tags: ['API tag'],
      },
      tasks: [{ id: 'task-1', title: 'API task', meta: 'API task meta', target: '/workbench' }],
      recentCourses: [{ id: 'course-1', title: 'API Course', meta: 'API course meta' }],
      recentDocuments: [{ id: 'doc-1', title: 'API Document', meta: 'API document meta' }],
    })

    renderDashboard()

    expect(screen.getByText('正在加载工作区总览...')).toBeInTheDocument()
    expect(await screen.findByText('API research focus')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('13')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('API task')).toBeInTheDocument()
    expect(screen.getByText('API Course')).toBeInTheDocument()
    expect(screen.getByText('API Document')).toBeInTheDocument()
    expect(screen.queryByText('补全文献综述中的教育场景证据')).not.toBeInTheDocument()
  })

  it('renders empty dashboard sections when API lists are empty', async () => {
    fetchDashboardSummary.mockResolvedValue({
      metrics: { documentBlocks: 0, evidenceSources: 0, graphUpdates: 0, normReminders: 0 },
      focus: { title: '暂无研究焦点', summary: '暂无摘要', tags: [] },
      tasks: [],
      recentCourses: [],
      recentDocuments: [],
    })

    renderDashboard()

    expect(await screen.findByText('暂无 AI 建议')).toBeInTheDocument()
    expect(screen.getByText('暂无最近课程')).toBeInTheDocument()
    expect(screen.getByText('暂无最近文档')).toBeInTheDocument()
  })

  it('renders an error state when dashboard summary fails', async () => {
    fetchDashboardSummary.mockRejectedValue(new Error('dashboard unavailable'))

    renderDashboard()

    expect(await screen.findByText('工作区总览加载失败')).toBeInTheDocument()
    expect(screen.getByText('dashboard unavailable')).toBeInTheDocument()
  })
})
