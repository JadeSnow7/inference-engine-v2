import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Library from '../Library'

const fetchEvidence = vi.hoisted(() => vi.fn())

vi.mock('../../api/library', () => ({
  fetchEvidence: (...args: unknown[]) => fetchEvidence(...args),
}))

function renderLibrary() {
  render(
    <BrowserRouter>
      <Library />
    </BrowserRouter>,
  )
}

describe('Library API evidence', () => {
  beforeEach(() => {
    fetchEvidence.mockReset()
  })

  it('loads evidence from the library API without static fallback data', async () => {
    fetchEvidence.mockResolvedValue({
      items: [{ id: 'api-evidence', title: 'API Evidence', venue: 'API Venue', year: 2026, score: 0.92, type: 'paper' }],
    })

    renderLibrary()

    expect(screen.getByText('正在加载证据库...')).toBeInTheDocument()
    expect(await screen.findByText('API Evidence')).toBeInTheDocument()
    expect(screen.queryByText('Large Language Models in Education: A Comprehensive Review')).not.toBeInTheDocument()
  })

  it('passes search and type filters to the evidence API', async () => {
    fetchEvidence.mockResolvedValue({ items: [] })

    renderLibrary()

    fireEvent.change(screen.getByLabelText('证据搜索'), { target: { value: 'HUST' } })
    fireEvent.change(screen.getByLabelText('证据类型'), { target: { value: 'norm' } })

    await waitFor(() => {
      expect(fetchEvidence).toHaveBeenLastCalledWith({ q: 'HUST', type: 'norm' })
    })
  })

  it('shows an empty state when evidence has not been generated yet', async () => {
    fetchEvidence.mockResolvedValue({ items: [] })

    renderLibrary()

    expect(await screen.findByText('暂无证据')).toBeInTheDocument()
    expect(screen.getByText('写作分析、SSE 检索或会话恢复后会在这里出现引用来源。')).toBeInTheDocument()
  })

  it('shows an error state when evidence fails to load', async () => {
    fetchEvidence.mockRejectedValue(new Error('library unavailable'))

    renderLibrary()

    expect(await screen.findByText('证据库加载失败')).toBeInTheDocument()
    expect(screen.getByText('library unavailable')).toBeInTheDocument()
  })
})
