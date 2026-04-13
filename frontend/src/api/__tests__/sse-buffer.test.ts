import { describe, it, expect } from 'vitest'

// Pure buffer parsing logic — extracted for unit testing
function parseSSEChunks(chunks: string[]): string[] {
  const results: string[] = []
  let buffer = ''
  for (const chunk of chunks) {
    buffer += chunk
    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      if (raw.startsWith('data: ')) {
        results.push(raw.slice(6))
      }
      boundary = buffer.indexOf('\n\n')
    }
  }
  return results
}

describe('SSE buffer parsing', () => {
  it('parses a single complete frame', () => {
    const result = parseSSEChunks(['data: {"type":"token","content":"你"}\n\n'])
    expect(result).toEqual(['{"type":"token","content":"你"}'])
  })

  it('handles frame split across two chunks', () => {
    const result = parseSSEChunks([
      'data: {"type":"token",',
      '"content":"好"}\n\n',
    ])
    expect(result).toEqual(['{"type":"token","content":"好"}'])
  })

  it('handles multiple frames in one chunk', () => {
    const result = parseSSEChunks([
      'data: {"type":"stage","stage":"路由中"}\n\ndata: {"type":"token","content":"a"}\n\n',
    ])
    expect(result).toHaveLength(2)
  })

  it('ignores incomplete trailing frame', () => {
    const result = parseSSEChunks(['data: {"type":"token","content":"x"}\n\ndata: incomplete'])
    expect(result).toHaveLength(1)
  })
})
