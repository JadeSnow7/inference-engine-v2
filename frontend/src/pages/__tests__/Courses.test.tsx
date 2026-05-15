import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Courses from '../Courses'
import { WORKBENCH_CONTEXT_KEY, useLayoutStore } from '../../store/layout'

const fetchResearchSpaces = vi.hoisted(() => vi.fn())
const openResearchSpace = vi.hoisted(() => vi.fn())

vi.mock('../../api/courses', () => ({
  fetchResearchSpaces: (...args: unknown[]) => fetchResearchSpaces(...args),
  openResearchSpace: (...args: unknown[]) => openResearchSpace(...args),
}))

function installSessionStorage() {
  const values = new Map<string, string>()
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  })
}

function renderCourses() {
  window.history.pushState({}, '', '/courses')
  render(
    <BrowserRouter>
      <Courses />
    </BrowserRouter>,
  )
}

const apiSpace = {
  id: 'space-1',
  title: 'API Course',
  teacher: 'Prof. API',
  topic: 'API backed research topic',
  literatureCount: 7,
  graphUpdates: 2,
  status: 'API loaded',
  material: {
    title: 'API Material',
    type: 'review',
    sourceType: 'paper',
  },
}

describe('Courses page API data', () => {
  beforeEach(() => {
    installSessionStorage()
    fetchResearchSpaces.mockReset()
    openResearchSpace.mockReset()
    useLayoutStore.setState({ workbenchContext: null })
  })

  it('loads research spaces from the courses API', async () => {
    fetchResearchSpaces.mockResolvedValue({ items: [apiSpace] })

    renderCourses()

    expect(screen.getByText('正在加载研究空间...')).toBeInTheDocument()
    expect(await screen.findByText('API Course')).toBeInTheDocument()
    expect(screen.getByText('API backed research topic')).toBeInTheDocument()
    expect(screen.queryByText('Principles of Microeconomics')).not.toBeInTheDocument()
  })

  it('shows an empty state when the API has no research spaces', async () => {
    fetchResearchSpaces.mockResolvedValue({ items: [] })

    renderCourses()

    expect(await screen.findByText('暂无研究空间')).toBeInTheDocument()
  })

  it('shows an error state when research spaces fail to load', async () => {
    fetchResearchSpaces.mockRejectedValue(new Error('courses unavailable'))

    renderCourses()

    expect(await screen.findByText('研究空间加载失败')).toBeInTheDocument()
    expect(screen.getByText('courses unavailable')).toBeInTheDocument()
  })

  it('opens a blank workbench without seeding the sample document title', async () => {
    fetchResearchSpaces.mockResolvedValue({ items: [] })

    renderCourses()

    await screen.findByText('暂无研究空间')

    const blankButton = screen.getByRole('button', { name: /打开空白工作台/ })
    expect(blankButton).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /进入研究工作台/ })).not.toBeInTheDocument()

    fireEvent.click(blankButton)

    expect(JSON.parse(window.sessionStorage.getItem(WORKBENCH_CONTEXT_KEY) ?? '{}')).toEqual(expect.objectContaining({
      sourceTitle: '未命名研究文档',
      courseTitle: '空白工作台',
    }))
    expect(screen.queryByText('大语言模型在教育领域的应用综述')).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/workbench')
  })

  it('opens a course through the API before navigating to the workbench', async () => {
    fetchResearchSpaces.mockResolvedValue({ items: [apiSpace] })
    openResearchSpace.mockResolvedValue({
      context: {
        sourceTitle: 'API Material',
        actionType: 'review',
        courseTitle: 'API Course',
        sourceType: 'paper',
        createdAt: '2026-05-13T00:00:00.000Z',
      },
      space: apiSpace,
    })

    renderCourses()

    fireEvent.click(await screen.findByRole('button', { name: /打开工作台/i }))

    await waitFor(() => {
      expect(openResearchSpace).toHaveBeenCalledWith('space-1')
    })
    expect(JSON.parse(window.sessionStorage.getItem(WORKBENCH_CONTEXT_KEY) ?? '{}')).toEqual(expect.objectContaining({
      sourceTitle: 'API Material',
      courseTitle: 'API Course',
    }))
    expect(window.location.pathname).toBe('/workbench')
  })
})
