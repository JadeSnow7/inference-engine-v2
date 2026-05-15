import { apiFetch } from './client'
import { useUserStore } from '../store/user'
import type { DocumentBlock } from '../types/workspace'

const BASE_URL = import.meta.env.VITE_API_BASE ?? ''

export type EditingMode = 'deep_edit' | 'academic_enhance' | 'citation_enhance' | 'originality_humanize'
export type EditingStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
export type EditingGateStatus = 'pass' | 'warning' | 'fail'

export interface EditingStageItem {
  stage_id: string
  label: string
  status: EditingStageStatus
  model?: string
  thinking?: boolean
  summary?: string
  error?: string
}

export interface EditingPatchItem {
  id: string
  stage_id: string
  block_id: string
  original_text: string
  revised_text: string
  reason: string
  risk_level?: 'low' | 'medium' | 'high'
  confidence?: number
}

export interface EditingReferenceItem {
  id: string
  title: string
  source?: string
  year?: number
  score?: number
  excerpt?: string
  status?: 'resolved' | 'unresolved'
  url?: string
}

export interface EditingGateReport {
  status: EditingGateStatus
  fidelity_score: number
  semantic_similarity: number
  citation_unresolved_count: number
  messages: string[]
}

export interface EditingJobStatus {
  job_id: string
  mode: EditingMode
  objective?: string
  status: 'created' | 'running' | 'completed' | 'failed'
  selected_block_ids: string[]
  stages: EditingStageItem[]
  patches: EditingPatchItem[]
  references: EditingReferenceItem[]
  gate_report?: EditingGateReport
  checkpoint_block_ids?: string[]
  error?: string
}

export interface EditingJobCreateRequest {
  blocks: DocumentBlock[]
  selected_block_ids?: string[]
  mode: EditingMode
  objective?: string
  session_id?: string
}

export interface EditingSSEHandlers {
  onEditingStage: (stage: EditingStageItem) => void
  onEditingPatch: (patch: EditingPatchItem) => void
  onEditingGate: (gate: EditingGateReport) => void
  onReferences?: (references: EditingReferenceItem[]) => void
  onDone: () => void
  onError: (message: string) => void
}

export interface EditingSSEController {
  abort: () => void
}

export function createEditingJob(request: EditingJobCreateRequest): Promise<EditingJobStatus> {
  return apiFetch<EditingJobStatus>('/v1/editing/jobs', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export function fetchEditingJob(jobId: string): Promise<EditingJobStatus> {
  return apiFetch<EditingJobStatus>(`/v1/editing/jobs/${jobId}`)
}

export function connectEditingJobSSE(jobId: string, handlers: EditingSSEHandlers): EditingSSEController {
  const controller = new AbortController()
  const token = useUserStore.getState().token

  fetch(`${BASE_URL}/v1/editing/jobs/${jobId}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        handlers.onError(body?.error?.message ?? `编辑任务启动失败 (${res.status})`)
        return
      }
      if (!res.body) {
        handlers.onError('编辑服务未返回数据流')
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let sawTerminalEvent = false

      const dispatchRawEvent = (raw: string) => {
        if (!raw.startsWith('data: ')) return
        try {
          const event = JSON.parse(raw.slice(6)) as { type: string; content?: string; data?: unknown }
          if (event.type === 'done' || event.type === 'error') {
            sawTerminalEvent = true
          }
          handleEditingEvent(event, handlers)
        } catch {
          // Ignore malformed frames; the stream may continue with valid events.
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let boundary = buffer.indexOf('\n\n')
        while (boundary !== -1) {
          const raw = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          dispatchRawEvent(raw)
          boundary = buffer.indexOf('\n\n')
        }
      }

      buffer += decoder.decode()
      if (buffer.trim()) {
        dispatchRawEvent(buffer.trim())
      }
      if (!sawTerminalEvent) {
        handlers.onError('编辑连接已提前结束，请重试')
      }
    })
    .catch((err: Error) => {
      if (err.name !== 'AbortError') {
        handlers.onError('编辑连接中断，请重试')
      }
    })

  return { abort: () => controller.abort() }
}

function handleEditingEvent(event: { type: string; content?: string; data?: unknown }, handlers: EditingSSEHandlers): void {
  switch (event.type) {
    case 'editing_stage':
      handlers.onEditingStage(event.data as EditingStageItem)
      break
    case 'editing_patch':
      handlers.onEditingPatch(event.data as EditingPatchItem)
      break
    case 'editing_gate':
      handlers.onEditingGate(event.data as EditingGateReport)
      break
    case 'references':
      handlers.onReferences?.((event.data as EditingReferenceItem[]) ?? [])
      break
    case 'done':
      handlers.onDone()
      break
    case 'error':
      handlers.onError(event.content ?? '编辑服务错误')
      break
  }
}

