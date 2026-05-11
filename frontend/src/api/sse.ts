import { useUserStore } from '../store/user'
import type { PaperItem, GapItem, ReferenceEventItem, SSEEvent } from '../types/events'

export interface SSEController {
  abort: () => void
}

export interface SSEHandlers {
  onSessionId?: (sessionId: string) => void
  onStage:  (stage: string)       => void
  onPapers: (papers: PaperItem[]) => void
  onGaps:   (gaps: GapItem[])     => void
  onReferences?: (references: ReferenceEventItem[]) => void
  onToken:  (token: string)       => void
  onDone:   ()                    => void
  onError:  (msg: string)         => void
}

const BASE_URL = import.meta.env.VITE_API_BASE ?? ''

export function connectSSE(
  message: string,
  handlers: SSEHandlers,
  sessionId?: string,
  mode?: string,
): SSEController {
  const controller = new AbortController()
  const token = useUserStore.getState().token

  const body: Record<string, string> = { message }
  if (sessionId) body.session_id = sessionId
  if (mode) body.mode = mode

  fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        const msg = body?.error?.message ?? `连接失败 (${res.status})`
        handlers.onError(msg)
        return
      }
      if (!res.body) {
        handlers.onError('服务未返回数据流')
        return
      }
      const resolvedSessionId = res.headers.get('X-Session-Id')
      if (resolvedSessionId) {
        handlers.onSessionId?.(resolvedSessionId)
      }

      const reader = res.body.getReader()
      // stream: true 防止多字节中文被截断
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        let boundary = buffer.indexOf('\n\n')
        while (boundary !== -1) {
          const raw = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)

          if (raw.startsWith('data: ')) {
            try {
              const event = JSON.parse(raw.slice(6)) as SSEEvent
              handleEvent(event, handlers)
            } catch {
              // 忽略格式错误的帧
            }
          }

          boundary = buffer.indexOf('\n\n')
        }
      }
    })
    .catch((err: Error) => {
      if (err.name !== 'AbortError') {
        handlers.onError('连接中断，请重试')
      }
    })

  return { abort: () => controller.abort() }
}

function handleEvent(event: SSEEvent, h: SSEHandlers): void {
  switch (event.type) {
    case 'stage':
      h.onStage(event.stage ?? '')
      break
    case 'papers':
      h.onPapers((event.data as PaperItem[]) ?? [])
      break
    case 'gaps':
      h.onGaps((event.data as GapItem[]) ?? [])
      break
    case 'references':
      h.onReferences?.((event.data as ReferenceEventItem[]) ?? [])
      break
    case 'token':
      h.onToken(event.content ?? '')
      break
    case 'done':
      h.onDone()
      break
    case 'error':
      h.onError(event.content ?? '服务错误')
      break
  }
}
