import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSSE } from '../useSSE'
import { useChatStore } from '../../store/chat'
import { usePipelineStore } from '../../store/pipeline'
import { useSidebarStore } from '../../store/sidebar'

const connectSSE = vi.hoisted(() => vi.fn())

vi.mock('../../api/sse', () => ({
  connectSSE: (...args: unknown[]) => connectSSE(...args),
}))

describe('useSSE', () => {
  beforeEach(() => {
    connectSSE.mockReset()
    useChatStore.setState({ messages: [], isStreaming: false, streamingId: null })
    usePipelineStore.setState({ currentStage: null, stageHistory: [] })
    useSidebarStore.setState({ papers: [], gaps: [], activeTab: 'papers' })
  })

  it('reuses the latest session id on follow-up chat sends', () => {
    connectSSE
      .mockImplementationOnce((_message, handlers) => {
        handlers.onSessionId?.('sess-chat-1')
        handlers.onDone()
        return { abort: vi.fn() }
      })
      .mockImplementationOnce((_message, handlers) => {
        handlers.onDone()
        return { abort: vi.fn() }
      })

    const { result } = renderHook(() => useSSE())

    act(() => result.current.send('第一条'))
    expect(connectSSE).toHaveBeenCalledTimes(1)
    expect(connectSSE.mock.calls[0][2]).toBeUndefined()

    act(() => result.current.send('第二条'))
    expect(connectSSE).toHaveBeenCalledTimes(2)
    expect(connectSSE.mock.calls[1][2]).toBe('sess-chat-1')
  })
})
