export type EventType = 'stage' | 'papers' | 'gaps' | 'token' | 'done' | 'error'

export interface SSEEvent {
  type: EventType
  content?: string
  stage?: string
  data?: PaperItem[] | GapItem[]
}

export interface PaperItem {
  id: string
  title: string
  year: number
  score: number
}

export interface GapItem {
  id: string
  description: string
  severity: 'high' | 'medium' | 'low'
  addressed_by: number
  score: number
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
