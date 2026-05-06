import { apiFetch } from './client'
import type { PaperItem, GapItem } from '../types/events'

export interface SessionItem {
  session_id:    string
  title:         string
  scene:         string
  updated_at:    number
  message_count: number
}

export interface SessionsResponse {
  total: number
  items: SessionItem[]
}

export interface SessionArtifact {
  papers?:       PaperItem[]
  gaps?:         GapItem[]
  final_outline?: string
}

export interface MessageItem {
  role:    'user' | 'assistant'
  content: string
}

export function fetchSessions(limit = 20, offset = 0): Promise<SessionsResponse> {
  return apiFetch<SessionsResponse>(`/api/sessions?limit=${limit}&offset=${offset}`)
}

export function deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/api/sessions/${sessionId}`, { method: 'DELETE' })
}

export function fetchSessionMessages(sessionId: string): Promise<{ messages: MessageItem[] }> {
  return apiFetch<{ messages: MessageItem[] }>(`/api/sessions/${sessionId}/messages`)
}

export function fetchSessionArtifact(sessionId: string): Promise<SessionArtifact> {
  return apiFetch<SessionArtifact>(`/api/sessions/${sessionId}/artifact`)
}

export interface UserProfile {
  teaching_style:     string
  feedback_verbosity: string
  writing_stage:      string
  major:              string
  weak_points:        Record<string, number>
  total_sessions:     number
  last_session_at:    number
}

export function fetchProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/profile/me')
}

export function patchProfile(updates: Partial<Pick<UserProfile, 'teaching_style' | 'feedback_verbosity'>>): Promise<{ updated: boolean }> {
  return apiFetch<{ updated: boolean }>('/api/profile/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

