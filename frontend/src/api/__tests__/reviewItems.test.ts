import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  acceptReviewItem,
  createReviewItem,
  deferReviewItem,
  fetchReviewItems,
  rejectReviewItem,
  updateReviewItem,
} from '../reviewItems'
import { updateEvidence } from '../library'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
})

function ok(data: unknown) {
  return Promise.resolve(new Response(JSON.stringify({ ok: true, data }), { status: 200 }))
}

function requestBody(callIndex: number) {
  return JSON.parse((fetchMock.mock.calls[callIndex][1] as RequestInit).body as string)
}

describe('review item api client', () => {
  it('fetches review items by document id', async () => {
    fetchMock.mockResolvedValue(ok({ items: [] }))

    await fetchReviewItems('doc-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/review-items?documentId=doc-1', expect.objectContaining({
      headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
    }))
  })

  it('creates and transitions review items', async () => {
    fetchMock.mockImplementation(() => ok({ id: 'review-1', status: 'pending' }))

    await createReviewItem({
      documentId: 'doc-1',
      source: 'document_tool',
      kind: 'rewrite',
      targetBlockIds: ['b1'],
      beforeBlocks: [],
      afterBlocks: [],
      changes: [],
      reason: 'Improve clarity',
      evidenceIds: [],
    })
    await updateReviewItem('review-1', { documentId: 'doc-1', status: 'deferred' })
    await acceptReviewItem('review-1', { documentId: 'doc-1', versionAfterId: 'v2' })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/review-items', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/review-items/review-1', expect.objectContaining({ method: 'PATCH' }))
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/review-items/review-1/accept', expect.objectContaining({ method: 'POST' }))
  })

  it('encodes review item ids and sends JSON request bodies', async () => {
    fetchMock.mockImplementation(() => ok({ id: 'review/1?#', status: 'pending' }))

    await updateReviewItem('review/1?#', { documentId: 'doc-1', status: 'deferred' })
    await acceptReviewItem('review/1?#', { documentId: 'doc-1', versionAfterId: 'v2' })
    await rejectReviewItem('review/1?#', { documentId: 'doc-1', status: 'rejected' })
    await deferReviewItem('review/1?#', { documentId: 'doc-1', status: 'deferred' })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/review-items/review%2F1%3F%23', expect.objectContaining({ method: 'PATCH' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/review-items/review%2F1%3F%23/accept', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/review-items/review%2F1%3F%23/reject', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/review-items/review%2F1%3F%23/defer', expect.objectContaining({ method: 'POST' }))
    expect(requestBody(0)).toEqual(expect.objectContaining({ documentId: 'doc-1', status: 'deferred' }))
    expect(requestBody(1)).toEqual(expect.objectContaining({ documentId: 'doc-1', versionAfterId: 'v2' }))
    expect(requestBody(2)).toEqual(expect.objectContaining({ documentId: 'doc-1', status: 'rejected' }))
    expect(requestBody(3)).toEqual(expect.objectContaining({ documentId: 'doc-1', status: 'deferred' }))
  })

  it('encodes evidence ids and sends JSON request bodies', async () => {
    fetchMock.mockImplementation(() => ok({ id: 'evidence/1?#', status: 'verified' }))

    await updateEvidence('evidence/1?#', {
      status: 'verified',
      linkedBlockIds: ['b1'],
      confidence: 0.92,
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/library/evidence/evidence%2F1%3F%23', expect.objectContaining({ method: 'PATCH' }))
    expect(requestBody(0)).toEqual(expect.objectContaining({
      status: 'verified',
      linkedBlockIds: ['b1'],
      confidence: 0.92,
    }))
  })
})
