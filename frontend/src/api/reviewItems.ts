import { apiFetch } from './client'
import type { ReviewItem, ReviewItemKind, ReviewItemSource, ReviewItemStatus } from '../types/workspace'

export interface ReviewItemsResponse {
  items: ReviewItem[]
}

export interface ReviewItemCreateInput {
  documentId: string
  source: ReviewItemSource
  kind: ReviewItemKind
  targetBlockIds: string[]
  beforeBlocks: ReviewItem['beforeBlocks']
  afterBlocks: ReviewItem['afterBlocks']
  changes: ReviewItem['changes']
  reason: string
  evidenceIds: string[]
  versionBeforeId?: string | null
  versionAfterId?: string | null
}

export interface ReviewItemUpdateInput {
  documentId: string
  status?: ReviewItemStatus
  targetBlockIds?: string[]
  beforeBlocks?: ReviewItem['beforeBlocks']
  afterBlocks?: ReviewItem['afterBlocks']
  changes?: ReviewItem['changes']
  reason?: string
  evidenceIds?: string[]
  versionBeforeId?: string | null
  versionAfterId?: string | null
}

export function fetchReviewItems(documentId: string): Promise<ReviewItemsResponse> {
  const params = new URLSearchParams({ documentId })
  return apiFetch<ReviewItemsResponse>(`/api/review-items?${params.toString()}`)
}

export function createReviewItem(input: ReviewItemCreateInput): Promise<ReviewItem> {
  return apiFetch<ReviewItem>('/api/review-items', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateReviewItem(id: string, input: ReviewItemUpdateInput): Promise<ReviewItem> {
  return apiFetch<ReviewItem>(`/api/review-items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function acceptReviewItem(id: string, input: ReviewItemUpdateInput): Promise<ReviewItem> {
  return apiFetch<ReviewItem>(`/api/review-items/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function rejectReviewItem(id: string, input: ReviewItemUpdateInput): Promise<ReviewItem> {
  return apiFetch<ReviewItem>(`/api/review-items/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function deferReviewItem(id: string, input: ReviewItemUpdateInput): Promise<ReviewItem> {
  return apiFetch<ReviewItem>(`/api/review-items/${encodeURIComponent(id)}/defer`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
