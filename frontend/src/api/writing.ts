import { apiFetch } from './client'

export interface WritingAnalyzeRequest {
  text: string
  mode?: 'norms' | 'citation' | 'structure'
  session_id?: string
}

export interface WritingAnalyzeResponse {
  nodes: Array<{ id: string; label: string; type?: string; score?: number }>
  expanded_context: Array<{ id: string; title: string; excerpt?: string; score?: number }>
  validation: Array<{ id: string; status: 'pass' | 'warning' | 'error'; message: string }>
  references: Array<{ id: string; title: string; year?: number; source?: string; score?: number }>
}

export function analyzeWriting(request: WritingAnalyzeRequest): Promise<WritingAnalyzeResponse> {
  return apiFetch<WritingAnalyzeResponse>('/v1/writing/analyze', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}
