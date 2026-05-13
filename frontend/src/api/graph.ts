import { apiFetch } from './client'

export interface GraphNode {
  id: string
  label: string
  type: string
  description: string
  referenceIds: string[]
  position: {
    x: number
    y: number
  }
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label: string
}

export interface GraphResponse {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphFilters {
  view?: string
}

export function fetchGraph(filters: GraphFilters = {}): Promise<GraphResponse> {
  const params = new URLSearchParams()
  if (filters.view) params.set('view', filters.view)
  const query = params.toString()
  return apiFetch<GraphResponse>(`/api/graph${query ? `?${query}` : ''}`)
}
