export type EventType = 'stage' | 'papers' | 'gaps' | 'references' | 'editing_stage' | 'editing_patch' | 'editing_gate' | 'token' | 'done' | 'error'

export interface SSEEvent {
  type: EventType
  content?: string
  stage?: string
  data?: PaperItem[] | GapItem[] | ReferenceEventItem[]
}

export interface PaperItem {
  id: string
  title?: string
  year?: number
  score?: number
}

export interface GapItem {
  id: string
  description?: string
  severity?: 'high' | 'medium' | 'low'
  addressed_by?: number
  score?: number
}

export interface ReferenceEventItem {
  id: string
  title?: string
  year?: number
  score?: number
  source?: string
  url?: string
  excerpt?: string
}

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string
  role: MessageRole
  content: string
  isStreaming: boolean
  timestamp: number
  scene?: string
}
