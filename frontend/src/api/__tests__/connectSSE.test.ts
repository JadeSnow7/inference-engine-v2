import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectSSE } from '../sse'

const encoder = new TextEncoder()

function makeResponse(bodyText: string, sessionId = 'sess-1'): Response {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(bodyText))
      controller.close()
    },
  })

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'X-Session-Id': sessionId,
    },
  })
}

describe('connectSSE', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads X-Session-Id and forwards it to handlers', async () => {
    const onSessionId = vi.fn()
    const onDone = vi.fn()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse('data: {"type":"done"}\n\n'),
      ),
    )

    connectSSE(
      '测试',
      {
        onSessionId,
        onStage: vi.fn(),
        onPapers: vi.fn(),
        onGaps: vi.fn(),
        onToken: vi.fn(),
        onDone,
        onError: vi.fn(),
      },
    )

    await vi.waitFor(() => {
      expect(onSessionId).toHaveBeenCalledWith('sess-1')
      expect(onDone).toHaveBeenCalledTimes(1)
    })
  })

  it('sends session_id on follow-up requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse('data: {"type":"done"}\n\n', 'sess-2'))
    vi.stubGlobal('fetch', fetchMock)

    connectSSE(
      '继续',
      {
        onStage: vi.fn(),
        onPapers: vi.fn(),
        onGaps: vi.fn(),
        onToken: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
      'sess-1',
    )

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBe(JSON.stringify({ message: '继续', session_id: 'sess-1' }))
  })
})
