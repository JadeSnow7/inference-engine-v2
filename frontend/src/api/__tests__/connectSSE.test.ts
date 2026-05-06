import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createJSONStorage } from 'zustand/middleware'
import { connectSSE } from '../sse'
import { useUserStore } from '../../store/user'

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
  beforeEach(() => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
      removeItem: (key: string) => { values.delete(key) },
    }
    vi.stubGlobal('localStorage', storage)
    useUserStore.persist.setOptions({ storage: createJSONStorage(() => storage) })
    useUserStore.setState({ token: null, userId: null })
  })

  afterEach(() => {
    useUserStore.setState({ token: null, userId: null })
    vi.restoreAllMocks()
  })

  it('posts to /api/chat with JSON headers and bearer token', async () => {
    useUserStore.setState({ token: 'token-1', userId: 'student@hust.edu.cn' })
    const fetchMock = vi.fn().mockResolvedValue(makeResponse('data: {"type":"done"}\n\n'))
    vi.stubGlobal('fetch', fetchMock)

    connectSSE(
      '测试',
      {
        onStage: vi.fn(),
        onPapers: vi.fn(),
        onGaps: vi.fn(),
        onToken: vi.fn(),
        onDone: vi.fn(),
        onError: vi.fn(),
      },
    )

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/chat')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer token-1',
    })
    expect(init.body).toBe(JSON.stringify({ message: '测试' }))
  })

  it('dispatches stage papers gaps token error and done events', async () => {
    const onStage = vi.fn()
    const onPapers = vi.fn()
    const onGaps = vi.fn()
    const onToken = vi.fn()
    const onError = vi.fn()
    const onDone = vi.fn()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse([
          'data: {"type":"stage","stage":"文献支撑检索"}',
          'data: {"type":"papers","data":[{"id":"p1","title":"Paper A","year":2024,"score":0.91}]}',
          'data: {"type":"gaps","data":[{"id":"g1","description":"Gap A","severity":"high","addressed_by":0,"score":0.8}]}',
          'data: {"type":"token","content":"正文"}',
          'data: {"type":"error","content":"轻微错误"}',
          'data: {"type":"done"}',
        ].join('\n\n') + '\n\n'),
      ),
    )

    connectSSE(
      '测试',
      {
        onStage,
        onPapers,
        onGaps,
        onToken,
        onDone,
        onError,
      },
    )

    await vi.waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1)
    })

    expect(onStage).toHaveBeenCalledWith('文献支撑检索')
    expect(onPapers).toHaveBeenCalledWith([{ id: 'p1', title: 'Paper A', year: 2024, score: 0.91 }])
    expect(onGaps).toHaveBeenCalledWith([{ id: 'g1', description: 'Gap A', severity: 'high', addressed_by: 0, score: 0.8 }])
    expect(onToken).toHaveBeenCalledWith('正文')
    expect(onError).toHaveBeenCalledWith('轻微错误')
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
