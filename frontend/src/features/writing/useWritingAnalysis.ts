import { useState } from 'react'
import { analyzeWriting, type WritingAnalyzeResponse } from '../../api/writing'
import { useWorkspaceStore } from '../../store/workspace'

export type WritingMode = 'norms' | 'citation' | 'structure'

export function useWritingAnalysis() {
  const [result, setResult] = useState<WritingAnalyzeResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const runAnalysis = async (text: string, mode: WritingMode, sessionId?: string) => {
    setLoading(true)
    setError('')

    try {
      const response = await analyzeWriting({
        text,
        mode,
        session_id: sessionId,
      })
      setResult(response)
      useWorkspaceStore.getState().upsertReferences(response.references)
      return response
    } catch (err) {
      const message = err instanceof Error ? err.message : '写作分析失败，请稍后重试。'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    result,
    error,
    loading,
    runAnalysis,
  }
}
