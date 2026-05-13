import { apiFetch } from './client'
import type { ReferenceItem } from '../types/workspace'

export interface EvidenceItem extends ReferenceItem {
  type?: 'paper' | 'norm' | 'dataset' | 'other'
}

export interface EvidenceResponse {
  items: EvidenceItem[]
}

export interface EvidenceFilters {
  q?: string
  type?: string
}

export function fetchEvidence(filters: EvidenceFilters = {}): Promise<EvidenceResponse> {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.type) params.set('type', filters.type)
  const query = params.toString()
  return apiFetch<EvidenceResponse>(`/api/library/evidence${query ? `?${query}` : ''}`)
}
