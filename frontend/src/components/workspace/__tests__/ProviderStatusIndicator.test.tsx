import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderStatusIndicator } from '../ProviderStatusIndicator'

const fetchConfigStatus = vi.hoisted(() => vi.fn())

vi.mock('../../../api/config', () => ({
  fetchConfigStatus: (...args: unknown[]) => fetchConfigStatus(...args),
}))

describe('ProviderStatusIndicator', () => {
  beforeEach(() => {
    fetchConfigStatus.mockReset()
    fetchConfigStatus.mockResolvedValue({
      active_provider: 'bailian_app',
      provider_preference: 'bailian_first',
      llm: { dashscope: 'configured', model: 'qwen-plus' },
      rag: { provider: 'disabled', configured: false },
      bailian_app: { enabled: true, configured: true, purpose: 'academic_norms' },
      local_rag_enabled: false,
    })
  })

  it('shows Bailian-first model and capability details from config status', async () => {
    render(<ProviderStatusIndicator />)

    expect(await screen.findByText('百炼优先')).toBeInTheDocument()
    expect(screen.getByText('qwen-plus')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /当前 AI 能力/ }))

    expect(screen.getByText('当前 AI 能力')).toBeInTheDocument()
    expect(screen.getByText('百炼 App：已启用')).toBeInTheDocument()
    expect(screen.getByText('RAG：未启用')).toBeInTheDocument()
    expect(screen.getByText('公网搜索：未接入')).toBeInTheDocument()
  })
})
