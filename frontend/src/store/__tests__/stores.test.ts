import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '../chat'
import { useSidebarStore } from '../sidebar'
import { usePipelineStore } from '../pipeline'

beforeEach(() => {
  useChatStore.setState({ messages: [], isStreaming: false, streamingId: null })
  useSidebarStore.setState({ papers: [], gaps: [], activeTab: 'papers' })
  usePipelineStore.setState({ currentStage: null, stageHistory: [] })
})

describe('useChatStore', () => {
  it('appendToken accumulates content', () => {
    const id = useChatStore.getState().startAssistantMessage()
    useChatStore.getState().appendToken(id, '你')
    useChatStore.getState().appendToken(id, '好')
    const msg = useChatStore.getState().messages.find((m) => m.id === id)
    expect(msg?.content).toBe('你好')
  })

  it('finalizeMessage sets isStreaming false on the message', () => {
    const id = useChatStore.getState().startAssistantMessage()
    useChatStore.getState().finalizeMessage(id)
    const msg = useChatStore.getState().messages.find((m) => m.id === id)
    expect(msg?.isStreaming).toBe(false)
  })

  it('resetStreaming clears isStreaming and streamingId', () => {
    useChatStore.setState({ isStreaming: true, streamingId: 'x' })
    useChatStore.getState().resetStreaming()
    expect(useChatStore.getState().isStreaming).toBe(false)
    expect(useChatStore.getState().streamingId).toBeNull()
  })
})

describe('useSidebarStore', () => {
  it('setPapers automatically switches activeTab to papers', () => {
    useSidebarStore.setState({ activeTab: 'gaps' })
    useSidebarStore.getState().setPapers([{ id: '1', title: 'T', year: 2023, score: 0.9 }])
    expect(useSidebarStore.getState().activeTab).toBe('papers')
  })

  it('setGaps does not auto-switch tab', () => {
    useSidebarStore.getState().setGaps([{ id: '1', description: 'D', severity: 'high', addressed_by: 0, score: 0.8 }])
    expect(useSidebarStore.getState().activeTab).toBe('papers')
  })
})

describe('usePipelineStore', () => {
  it('setStage appends to stageHistory', () => {
    usePipelineStore.getState().setStage('路由中')
    usePipelineStore.getState().setStage('意图解析')
    expect(usePipelineStore.getState().stageHistory).toEqual(['路由中', '意图解析'])
    expect(usePipelineStore.getState().currentStage).toBe('意图解析')
  })

  it('clearStages resets both fields', () => {
    usePipelineStore.getState().setStage('路由中')
    usePipelineStore.getState().clearStages()
    expect(usePipelineStore.getState().stageHistory).toEqual([])
    expect(usePipelineStore.getState().currentStage).toBeNull()
  })
})
