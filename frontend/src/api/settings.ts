import { apiFetch } from './client'

export interface WorkspaceSettings {
  workspaceDensity: 'comfortable' | 'compact'
  autoSave: boolean
  notificationsEnabled: boolean
  citationStyle: string
}

export function fetchSettings(): Promise<WorkspaceSettings> {
  return apiFetch<WorkspaceSettings>('/api/settings')
}

export function updateSettings(settings: WorkspaceSettings): Promise<WorkspaceSettings> {
  return apiFetch<WorkspaceSettings>('/api/settings', {
    method: 'PATCH',
    body: JSON.stringify(settings),
  })
}
