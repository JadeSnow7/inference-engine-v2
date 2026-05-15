import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from '../client'
import { connectEditingJobSSE, createEditingJob, fetchEditingJob } from '../editing'

vi.mock('../client', () => ({
  apiFetch: vi.fn(),
}))

const encoder = new TextEncoder()

function makeResponse(bodyText: string): Response {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(bodyText))
      controller.close()
    },
  })
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

describe('editing api', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.restoreAllMocks()
  })

  it('creates and fetches editing jobs through /v1/editing/jobs', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ job_id: 'edit-1', stages: [], patches: [], references: [] })
      .mockResolvedValueOnce({ job_id: 'edit-1', stages: [], patches: [], references: [] })

    await createEditingJob({
      blocks: [{ id: 'p1', type: 'paragraph', content: '原文' }],
      selected_block_ids: ['p1'],
      mode: 'academic_enhance',
      objective: '提升学术表达',
    })
    await fetchEditingJob('edit-1')

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/v1/editing/jobs', {
      method: 'POST',
      body: JSON.stringify({
        blocks: [{ id: 'p1', type: 'paragraph', content: '原文' }],
        selected_block_ids: ['p1'],
        mode: 'academic_enhance',
        objective: '提升学术表达',
      }),
    })
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/v1/editing/jobs/edit-1')
  })

  it('streams editing stage patch gate and references events', async () => {
    const onEditingStage = vi.fn()
    const onEditingPatch = vi.fn()
    const onEditingGate = vi.fn()
    const onReferences = vi.fn()
    const onDone = vi.fn()

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeResponse([
      'data: {"type":"editing_stage","data":{"stage_id":"route_diagnosis","status":"running","label":"路由诊断"}}',
      'data: {"type":"editing_patch","data":{"id":"patch-1","block_id":"p1","original_text":"原文","revised_text":"新文","reason":"学术增强"}}',
      'data: {"type":"references","data":[{"id":"citation-unresolved","title":"未找到来源","status":"unresolved"}]}',
      'data: {"type":"editing_gate","data":{"status":"pass","fidelity_score":0.94,"messages":["通过"]}}',
      'data: {"type":"done"}',
    ].join('\n\n') + '\n\n')))

    connectEditingJobSSE('edit-1', {
      onEditingStage,
      onEditingPatch,
      onEditingGate,
      onReferences,
      onDone,
      onError: vi.fn(),
    })

    await vi.waitFor(() => {
      expect(onDone).toHaveBeenCalledTimes(1)
    })

    expect(onEditingStage).toHaveBeenCalledWith(expect.objectContaining({ stage_id: 'route_diagnosis' }))
    expect(onEditingPatch).toHaveBeenCalledWith(expect.objectContaining({ block_id: 'p1' }))
    expect(onReferences).toHaveBeenCalledWith([expect.objectContaining({ status: 'unresolved' })])
    expect(onEditingGate).toHaveBeenCalledWith(expect.objectContaining({ status: 'pass' }))
  })
})
