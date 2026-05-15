import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import App from '../../App'
import { analyzeWriting } from '../../api/writing'
import { useUserStore } from '../../store/user'
import { useWorkspaceStore } from '../../store/workspace'

vi.mock('../../api/writing', () => ({
  analyzeWriting: vi.fn(),
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

describe('Writing page', () => {
  beforeEach(() => {
    installMemoryStorage()
    window.history.pushState({}, '', '/writing')
    useUserStore.setState({ token: 'token-1', userId: 'alex@hust.edu.cn' })
    useWorkspaceStore.getState().resetWorkspace()
    vi.mocked(analyzeWriting).mockReset()
  })

  it('runs writing analysis and renders nodes context validation and references', async () => {
    vi.mocked(analyzeWriting).mockResolvedValue({
      nodes: [{ id: 'node-1', label: '研究问题明确性', type: 'norm', score: 0.86 }],
      expanded_context: [{ id: 'ctx-1', title: '华中科技大学本科论文规范', excerpt: '摘要应凝练说明研究目的、方法和结论。', score: 0.93 }],
      validation: [{ id: 'val-1', status: 'warning', message: '摘要缺少方法说明。' }],
      references: [{ id: 'ref-1', title: '本科毕业论文写作规范', year: 2026, source: 'HUST Norm Corpus', score: 0.91 }],
    })

    render(<App />)

    expect(screen.getByRole('heading', { name: 'AI 写作' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('待分析文本'), {
      target: { value: '本文研究大语言模型在教育领域中的应用。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '分析学术规范' }))

    expect(await screen.findByText('研究问题明确性')).toBeInTheDocument()
    expect(screen.getByText('华中科技大学本科论文规范')).toBeInTheDocument()
    expect(screen.getByText('摘要缺少方法说明。')).toBeInTheDocument()
    expect(screen.getByText('本科毕业论文写作规范')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '推入审阅队列' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '引文核查' }))
    fireEvent.click(screen.getByRole('button', { name: '推入审阅队列' }))
    expect(screen.getByText('已推入工作台审阅队列')).toBeInTheDocument()
    expect(useWorkspaceStore.getState().reviewItems[0]).toMatchObject({
      documentId: 'local-draft',
      source: 'writing_analysis',
      kind: 'norm',
      status: 'pending',
      reason: '摘要缺少方法说明。',
      evidenceIds: ['ref-1'],
      versionAfterId: null,
    })
    expect(useWorkspaceStore.getState().reviewItems[0].changes[0]).toMatchObject({
      id: 'writing-val-1',
      blockId: 'val-1',
      type: 'modify',
      revisedText: '摘要缺少方法说明。',
      reason: 'warning',
    })
    expect(analyzeWriting).toHaveBeenCalledWith({
      text: '本文研究大语言模型在教育领域中的应用。',
      mode: 'norms',
      session_id: undefined,
    })
    expect(useWorkspaceStore.getState().references.some(reference => reference.id === 'ref-1')).toBe(true)
  })
})
