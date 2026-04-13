import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Message } from '../types/events'

function genId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

interface ChatState {
  messages: Message[]
  isStreaming: boolean
  streamingId: string | null
  addUserMessage: (content: string) => string
  startAssistantMessage: () => string
  appendToken: (id: string, token: string) => void
  finalizeMessage: (id: string) => void
  setStreaming: (v: boolean) => void
  resetStreaming: () => void
  clearAll: () => void
}

export const useChatStore = create<ChatState>()(
  immer((set) => ({
    messages: [],
    isStreaming: false,
    streamingId: null,

    addUserMessage: (content) => {
      const id = genId()
      set((s) => {
        s.messages.push({ id, role: 'user', content, isStreaming: false, timestamp: Date.now() })
      })
      return id
    },

    startAssistantMessage: () => {
      const id = genId()
      set((s) => {
        s.messages.push({ id, role: 'assistant', content: '', isStreaming: true, timestamp: Date.now() })
        s.isStreaming = true
        s.streamingId = id
      })
      return id
    },

    appendToken: (id, token) => {
      set((s) => {
        const msg = s.messages.find((m) => m.id === id)
        if (msg) msg.content += token
      })
    },

    finalizeMessage: (id) => {
      set((s) => {
        const msg = s.messages.find((m) => m.id === id)
        if (msg) msg.isStreaming = false
        s.isStreaming = false
        s.streamingId = null
      })
    },

    setStreaming: (v) => set((s) => { s.isStreaming = v }),

    resetStreaming: () => set((s) => {
      s.isStreaming = false
      s.streamingId = null
    }),

    clearAll: () => set((s) => {
      s.messages = []
      s.isStreaming = false
      s.streamingId = null
    }),
  })),
)
