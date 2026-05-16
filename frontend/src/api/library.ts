import { apiFetch } from './client'
import type { EvidenceLedgerItem, EvidenceStatus } from '../types/workspace'

export interface EvidenceItem extends EvidenceLedgerItem {}

export interface EvidenceResponse {
  items: EvidenceItem[]
}

export interface EvidenceFilters {
  q?: string
  type?: string
  status?: EvidenceStatus
}

export interface EvidenceUpdateInput {
  status?: EvidenceStatus
  linkedBlockIds?: string[]
  confidence?: number
  sourceType?: string
  verifiedAt?: string
  usedAt?: string
}

export function fetchEvidence(filters: EvidenceFilters = {}): Promise<EvidenceResponse> {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.type) params.set('type', filters.type)
  if (filters.status) params.set('status', filters.status)
  const query = params.toString()
  return apiFetch<EvidenceResponse>(`/api/library/evidence${query ? `?${query}` : ''}`)
}

export function updateEvidence(evidenceId: string, input: EvidenceUpdateInput): Promise<EvidenceItem> {
  return apiFetch<EvidenceItem>(`/api/library/evidence/${encodeURIComponent(evidenceId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}
