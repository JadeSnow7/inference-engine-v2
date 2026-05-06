import { workspaceMock } from '../mocks/workspaceMock'
import type {
  AIRunStatus,
  DocumentSuggestion,
  DocumentVersion,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceSnapshot,
} from '../types/workspace'

// Workspace-specific backend routes are not available yet.
// Keep these methods as explicit demo fallbacks; live AI generation in /workbench
// uses the shared /api/chat SSE path through api/sse.ts.

export interface CreateAIRunPayload {
  projectId: string
  documentId: string
  message: string
  selectedBlockId?: string | null
}

export interface AIRun {
  id: string
  status: AIRunStatus
}

export interface AIRunSubscriptionHandlers {
  onStatus: (status: AIRunStatus) => void
  onSuggestion: (suggestion: DocumentSuggestion) => void
  onError: (message: string) => void
}

export interface SubscriptionController {
  abort: () => void
}

export async function createAIRun(payload: CreateAIRunPayload): Promise<AIRun> {
  return {
    id: `mock-run-${payload.projectId}-${Date.now()}`,
    status: 'generating',
  }
}

export function subscribeAIRun(runId: string, handlers: AIRunSubscriptionHandlers): SubscriptionController {
  handlers.onStatus('generating')
  const timeoutId = window.setTimeout(() => {
    if (!runId) {
      handlers.onError('AI 任务不存在')
      return
    }
    handlers.onSuggestion(workspaceMock.aiSuggestion)
    handlers.onStatus('done')
  }, 1000)

  return {
    abort: () => window.clearTimeout(timeoutId),
  }
}

export async function acceptSuggestion(suggestionId: string): Promise<{ accepted: boolean; suggestionId: string }> {
  return { accepted: true, suggestionId }
}

export async function rejectSuggestion(suggestionId: string): Promise<{ rejected: boolean; suggestionId: string }> {
  return { rejected: true, suggestionId }
}

export async function getWorkspace(projectId: string): Promise<WorkspaceSnapshot & { projectId: string }> {
  return { ...workspaceMock, projectId }
}

export async function getKnowledgeGraph(projectId: string): Promise<{
  projectId: string
  nodes: WorkspaceGraphNode[]
  edges: WorkspaceGraphEdge[]
}> {
  return {
    projectId,
    nodes: workspaceMock.graphNodes,
    edges: workspaceMock.graphEdges,
  }
}

export async function getDocumentVersions(documentId: string): Promise<{
  documentId: string
  versions: DocumentVersion[]
}> {
  return {
    documentId,
    versions: workspaceMock.documentVersions,
  }
}

export async function rollbackVersion(versionId: string): Promise<{ rolledBack: boolean; versionId: string }> {
  return { rolledBack: true, versionId }
}
