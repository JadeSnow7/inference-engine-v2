import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../client'
import { analyzeWriting } from '../writing'

vi.mock('../client', () => ({
  apiFetch: vi.fn(),
}))

describe('analyzeWriting', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('posts academic writing analysis requests to /v1/writing/analyze', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      nodes: [{ id: 'n1', label: '研究问题', score: 0.88 }],
      expanded_context: [{ id: 'ctx1', title: '写作规范', excerpt: '避免无依据泛化。' }],
      validation: [{ id: 'v1', status: 'warning', message: '缺少规范来源。' }],
      references: [{ id: 'r1', title: 'HUST thesis norm', year: 2026 }],
    })

    const result = await analyzeWriting({
      text: '本文研究大语言模型在教育领域的应用。',
      mode: 'norms',
      session_id: 'sess-1',
    })

    expect(apiFetch).toHaveBeenCalledWith('/v1/writing/analyze', {
      method: 'POST',
      body: JSON.stringify({
        text: '本文研究大语言模型在教育领域的应用。',
        mode: 'norms',
        session_id: 'sess-1',
      }),
    })
    expect(result.references[0].title).toBe('HUST thesis norm')
  })
})
