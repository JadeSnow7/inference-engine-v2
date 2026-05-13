import { apiFetch } from './client'

export interface DashboardMetrics {
  documentBlocks: number
  evidenceSources: number
  graphUpdates: number
  normReminders: number
}

export interface DashboardFocus {
  title: string
  summary: string
  tags: string[]
}

export interface DashboardLinkItem {
  id: string
  title: string
  meta: string
  target?: string
}

export interface DashboardSummary {
  metrics: DashboardMetrics
  focus: DashboardFocus
  tasks: DashboardLinkItem[]
  recentCourses: DashboardLinkItem[]
  recentDocuments: DashboardLinkItem[]
}

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiFetch<DashboardSummary>('/api/dashboard/summary')
}
