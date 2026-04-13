import { useCallback, useEffect, useRef } from 'react'
import { connectSSE, type SSEController } from '../api/sse'
import { useChatStore } from '../store/chat'
import { usePipelineStore } from '../store/pipeline'
import { useSidebarStore } from '../store/sidebar'

export function useSSE() {
  // Constraint B: AbortController singleton — one active stream at a time
  const controllerRef = useRef<SSEController | null>(null)

  const send = useCallback((message: string) => {
    // Constraint B: abort previous request before starting new one
    controllerRef.current?.abort()

    // Constraint C: reset all state before new request
    useChatStore.getState().resetStreaming()
    usePipelineStore.getState().clearStages()
    useSidebarStore.getState().clear()

    useChatStore.getState().addUserMessage(message)
    const assistantId = useChatStore.getState().startAssistantMessage()

    controllerRef.current = connectSSE(message, {
      onStage: (stage) => usePipelineStore.getState().setStage(stage),
      onPapers: (papers) => useSidebarStore.getState().setPapers(papers),
      onGaps: (gaps) => useSidebarStore.getState().setGaps(gaps),
      onToken: (token) => useChatStore.getState().appendToken(assistantId, token),
      onDone: () => useChatStore.getState().finalizeMessage(assistantId),
      // Constraint H: error appended as blockquote, then finalized
      onError: (msg) => {
        useChatStore.getState().appendToken(assistantId, `\n\n> ⚠ ${msg}`)
        useChatStore.getState().finalizeMessage(assistantId)
      },
    })
  }, [])

  // Constraint I: abort on component unmount
  useEffect(() => () => { controllerRef.current?.abort() }, [])

  return {
    send,
    isStreaming: useChatStore((s) => s.isStreaming),
  }
}
