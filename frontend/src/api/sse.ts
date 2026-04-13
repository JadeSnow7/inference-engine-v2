import type { PaperItem, GapItem, SSEEvent } from '../types/events'

export interface SSEController {
  abort: () => void
}

export interface SSEHandlers {
  onStage: (stage: string) => void
  onPapers: (papers: PaperItem[]) => void
  onGaps: (gaps: GapItem[]) => void
  onToken: (token: string) => void
  onDone: () => void
  onError: (msg: string) => void
}

const BASE_URL = import.meta.env.VITE_API_BASE ?? ''

export function connectSSE(message: string, handlers: SSEHandlers): SSEController {
  const controller = new AbortController()
  const token = localStorage.getItem('edu_token')

  fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message }),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.body) return

      const reader = res.body.getReader()
      // Constraint A: stream-mode TextDecoder prevents multi-byte Chinese split
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
              // Constraint A: silently skip malformed frames
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
