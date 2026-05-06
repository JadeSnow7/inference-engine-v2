export type ConversationStatus = 'active' | 'archived'

export interface ConversationItem {
  id: string
  title: string
  preview: string
  timeLabel: string
  status: ConversationStatus
}

export interface DocumentVersion {
  id: string
  label: string
  summary: string
  updatedAt: string
  isCurrent: boolean
}

export interface DocumentVersionSnapshot extends DocumentVersion {
  documentBlocks: DocumentBlock[]
  createdAt: string
  suggestionId?: string
  changeCount?: number
}

export type DocumentBlockType = 'heading' | 'paragraph'

export interface CitationMarker {
  id: string
  label: string
  referenceId: string
}

export type CitationRiskLevel = 'missing' | 'unmatched' | 'matched'

export interface DocumentBlock {
  id: string
  type: DocumentBlockType
  headingLevel?: 1 | 2 | 3
  title?: string
  content: string
  citations?: CitationMarker[]
  keywords?: string[]
}

export type SuggestionOperation = 'replace_blocks'

export type SuggestionChangeType = 'delete' | 'insert' | 'modify'

export interface SuggestionChange {
  id: string
  blockId: string
  type: SuggestionChangeType
  originalText: string
  revisedText: string
  reason: string
}

export interface DocumentSuggestion {
  id: string
  title: string
  summary: string
  targetBlockIds: string[]
  operation: SuggestionOperation
  beforeBlocks: DocumentBlock[]
  afterBlocks: DocumentBlock[]
  reason: string
  confidence: number
  changes: SuggestionChange[]
  reasons: string[]
  reasoningSteps: string[]
  createdAt: string
}

export type AIRunStatus = 'idle' | 'retrieving' | 'reasoning' | 'generating' | 'done' | 'error' | 'canceled'
export type WorkspaceSaveStatus = 'saved' | 'modified' | 'local-saved'

export type RightPanelMode = 'graph' | 'list'

export type GraphNodeType = 'core' | 'concept' | 'method' | 'technology' | 'paper' | 'gap'

export interface ReferenceItem {
  id: string
  title: string
  authors?: string
  year?: number
  venue?: string
  score?: number
}

export interface WorkspaceGraphNode {
  id: string
  label: string
  type: GraphNodeType
  description: string
  referenceIds: string[]
  blockIds?: string[]
  position: {
    x: number
    y: number
  }
}

export interface WorkspaceGraphEdge {
  id: string
  source: string
  target: string
  label: string
}

export interface WorkspaceSnapshot {
  conversations: ConversationItem[]
  documentVersions: DocumentVersion[]
  documentBlocks: DocumentBlock[]
  aiSuggestion: DocumentSuggestion
  graphNodes: WorkspaceGraphNode[]
  graphEdges: WorkspaceGraphEdge[]
  references: ReferenceItem[]
}
