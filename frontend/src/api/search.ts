import { apiFetch } from './client'

export type SearchScope = 'global' | 'workspace' | 'documents' | 'conversations' | 'library' | 'courses'

export interface SearchResult {
  id: string
  type: string
  title: string
  excerpt: string
  target: string
  meta: string
}

export interface SearchResponse {
  items: SearchResult[]
}

export interface SearchFilters {
  q: string
  scope?: SearchScope
}

export function searchItems({ q, scope = 'global' }: SearchFilters): Promise<SearchResponse> {
  const params = new URLSearchParams()
  params.set('q', q)
  params.set('scope', scope)
  return apiFetch<SearchResponse>(`/api/search?${params.toString()}`)
}
