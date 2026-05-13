import { create } from 'zustand'
import {
  createDocument,
  createDocumentVersion as createBackendDocumentVersion,
  fetchDocument,
  fetchDocumentVersions,
  restoreDocumentVersion as restoreBackendDocumentVersion,
  updateDocument,
  type PersistedDocument,
  type PersistedDocumentVersion,
} from '../api/documents'
import { fetchSessionArtifact, fetchSessionMessages, type MessageItem } from '../api/sessions'
import { workspaceMock } from '../mocks/workspaceMock'
import type { GapItem, PaperItem, ReferenceEventItem } from '../types/events'
import { changedVersionBlocks } from '../features/version/versionDiff'
import type {
  AIRunStatus,
  DocumentBlock,
  DocumentSuggestion,
  DocumentVersionSnapshot,
  ReferenceItem,
  RightPanelMode,
  SuggestionChange,
  WorkspaceGraphEdge,
  WorkspaceGraphNode,
  WorkspaceSaveStatus,
} from '../types/workspace'

export const WORKBENCH_DRAFT_KEY = 'workbench:documentBlocks:v1'
export const WORKBENCH_SNAPSHOT_KEY = 'workbench:workspaceSnapshot:v1'
const MAX_LOCAL_VERSION_SNAPSHOTS = 8

interface StoredWorkspaceSnapshot {
  schemaVersion: 1
  activeVersionId: string | null
  documentBlocks: DocumentBlock[]
  documentVersions: DocumentVersionSnapshot[]
}

interface CitationEnhancementRequest {
  id: string
  blockId: string
}

type AIRunMode = 'rewrite' | 'citation_enhance'

interface RestoreNotice {
  versionTitle: string
  changedBlockCount: number
  restoredAt: string
}

interface WorkspaceState {
  activeDocumentId: string | null
  activeConversationId: string | null
  activeVersionId: string | null
  activeSessionId: string | null
  previewVersionId: string | null
  isRestoringVersion: boolean
  selectedGraphNodeId: string | null
  selectedReferenceId: string | null
  selectedBlockId: string | null
  rightPanelMode: RightPanelMode
  aiRunStatus: AIRunStatus
  aiStageLabel: string
  aiErrorMessage: string
  generatedText: string
  saveStatus: WorkspaceSaveStatus
  documentErrorMessage: string
  restoreSessionNotice: string
  restoredMessages: MessageItem[]
  lastRestoreNotice: RestoreNotice | null
  currentSuggestion: DocumentSuggestion | null
  citationEnhancementRequest: CitationEnhancementRequest | null
  currentChangeIndex: number
  documentVersions: DocumentVersionSnapshot[]
  documentBlocks: DocumentBlock[]
  pendingBeforeBlocks: DocumentBlock[]
  ragPapers: PaperItem[]
  ragGaps: GapItem[]
  graphNodes: WorkspaceGraphNode[]
  graphEdges: WorkspaceGraphEdge[]
  references: ReferenceItem[]
  setActiveConversation: (id: string) => void
  setActiveVersion: (id: string) => void
  startVersionPreview: (id: string) => void
  cancelVersionPreview: () => void
  restorePreviewVersion: () => void
  setActiveSessionId: (id: string) => void
  restoreSession: (id: string) => Promise<void>
  setSelectedGraphNode: (id: string) => void
  selectCitationReference: (referenceId: string, blockId: string) => void
  setSelectedBlock: (id: string) => void
  setRightPanelMode: (mode: RightPanelMode) => void
  setAIRunStatus: (status: AIRunStatus) => void
  setAIStage: (status: AIRunStatus, label: string) => void
  setSaveStatus: (status: WorkspaceSaveStatus) => void
  loadDocument: (documentId: string) => Promise<void>
  saveCurrentDocument: () => Promise<void>
  createCurrentDocumentVersion: (label?: string) => Promise<void>
  restoreDocumentVersion: (versionId: string) => Promise<void>
  setRestoreSessionNotice: (notice: string) => void
  dismissRestoreNotice: () => void
  setCurrentSuggestion: (suggestion: DocumentSuggestion | null) => void
  requestCitationEnhancement: (blockId: string) => void
  setCurrentChangeIndex: (index: number) => void
  aiRunMode: AIRunMode
  startAIRun: (targetBlockIdOverride?: string) => DocumentBlock | null
  startCitationEnhancement: (blockId: string) => DocumentBlock | null
  appendGeneratedToken: (token: string) => void
  finishAIRunAsSuggestion: () => void
  failAIRunWithFallback: (message: string) => void
  cancelAIRun: () => void
  upsertRagPapers: (papers: PaperItem[]) => void
  upsertRagGaps: (gaps: GapItem[]) => void
  upsertReferences: (references: ReferenceEventItem[]) => void
  clearRagArtifacts: () => void
  nextChange: () => void
  previousChange: () => void
  acceptCurrentChange: () => void
  acceptSuggestion: () => void
  rejectSuggestion: () => void
  hydrateLocalDraft: () => void
  resetWorkspace: () => void
}

function cloneDocumentBlocksFrom(blocks: DocumentBlock[]): DocumentBlock[] {
  return blocks.map(block => ({
    ...block,
    citations: block.citations?.map(citation => ({ ...citation })),
    keywords: block.keywords ? [...block.keywords] : undefined,
  }))
}

function cloneDocumentBlocks(): DocumentBlock[] {
  return cloneDocumentBlocksFrom(workspaceMock.documentBlocks)
}

function cloneVersionSnapshot(version: DocumentVersionSnapshot): DocumentVersionSnapshot {
  return {
    ...version,
    documentBlocks: cloneDocumentBlocksFrom(version.documentBlocks),
  }
}

function createInitialVersionSnapshots(documentBlocks: DocumentBlock[]): DocumentVersionSnapshot[] {
  const createdAt = new Date().toISOString()

  return workspaceMock.documentVersions.map(version => ({
    ...version,
    createdAt,
    documentBlocks: cloneDocumentBlocksFrom(documentBlocks),
  }))
}

function cloneSuggestion(suggestion: DocumentSuggestion): DocumentSuggestion {
  return {
    ...suggestion,
    targetBlockIds: [...suggestion.targetBlockIds],
    beforeBlocks: suggestion.beforeBlocks.map(block => cloneDocumentBlock(block)),
    afterBlocks: suggestion.afterBlocks.map(block => cloneDocumentBlock(block)),
    changes: suggestion.changes.map(change => ({ ...change })),
    reasons: [...suggestion.reasons],
    reasoningSteps: [...suggestion.reasoningSteps],
  }
}

function cloneDocumentBlock(block: DocumentBlock): DocumentBlock {
  return {
    ...block,
    citations: block.citations?.map(citation => ({ ...citation })),
    keywords: block.keywords ? [...block.keywords] : undefined,
  }
}

function cloneGraphNode(node: WorkspaceGraphNode): WorkspaceGraphNode {
  return {
    ...node,
    referenceIds: [...node.referenceIds],
    blockIds: node.blockIds ? [...node.blockIds] : undefined,
    position: { ...node.position },
  }
}

function cloneGraphEdge(edge: WorkspaceGraphEdge): WorkspaceGraphEdge {
  return { ...edge }
}

function cloneReference(reference: ReferenceItem): ReferenceItem {
  return { ...reference }
}

function clonePaper(paper: PaperItem): PaperItem {
  return { ...paper }
}

function cloneGap(gap: GapItem): GapItem {
  return { ...gap }
}

function cloneGraphNodes(): WorkspaceGraphNode[] {
  return workspaceMock.graphNodes.map(cloneGraphNode)
}

function cloneGraphEdges(): WorkspaceGraphEdge[] {
  return workspaceMock.graphEdges.map(cloneGraphEdge)
}

function cloneReferences(): ReferenceItem[] {
  return workspaceMock.references.map(cloneReference)
}

function initialWorkspaceState() {
  const documentBlocks = cloneDocumentBlocks()
  const documentVersions = createInitialVersionSnapshots(documentBlocks)

  return {
    activeDocumentId: null,
    activeConversationId: null,
    activeVersionId: documentVersions[0]?.id ?? null,
    activeSessionId: null,
    previewVersionId: null,
    isRestoringVersion: false,
    selectedGraphNodeId: 'cnn',
    selectedReferenceId: null,
    selectedBlockId: null,
    rightPanelMode: 'graph' as RightPanelMode,
    aiRunStatus: 'idle' as AIRunStatus,
    aiStageLabel: '',
    aiErrorMessage: '',
    generatedText: '',
    saveStatus: 'saved' as WorkspaceSaveStatus,
    documentErrorMessage: '',
    restoreSessionNotice: '',
    restoredMessages: [],
    lastRestoreNotice: null,
    currentSuggestion: null,
    citationEnhancementRequest: null,
    aiRunMode: 'rewrite' as AIRunMode,
    currentChangeIndex: 0,
    documentVersions,
    documentBlocks,
    pendingBeforeBlocks: [],
    ragPapers: [],
    ragGaps: [],
    graphNodes: cloneGraphNodes(),
    graphEdges: cloneGraphEdges(),
    references: cloneReferences(),
  }
}

function documentTitleFromBlocks(blocks: DocumentBlock[]): string {
  return blocks.find(block => block.type === 'heading')?.content.trim() || '研究工作台文档'
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : '文档服务暂时不可用'
}

function versionSnapshotFromApi(
  version: PersistedDocumentVersion,
  isCurrent: boolean,
): DocumentVersionSnapshot {
  return {
    id: version.id,
    label: version.label || '后端版本',
    summary: version.title ? `保存自 ${version.title}` : '后端保存的文档版本',
    updatedAt: version.createdAt,
    isCurrent,
    createdAt: version.createdAt,
    documentBlocks: cloneDocumentBlocksFrom(version.blocks),
  }
}

function documentBlocksFromApi(document: PersistedDocument): DocumentBlock[] {
  return cloneDocumentBlocksFrom(document.blocks)
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage ?? null
}

function persistWorkspaceSnapshot(snapshot: StoredWorkspaceSnapshot): boolean {
  try {
    getLocalStorage()?.setItem(WORKBENCH_SNAPSHOT_KEY, JSON.stringify(snapshot))
    return true
  } catch {
    // Local persistence is a demo fallback; keep in-memory state if storage is unavailable.
    return false
  }
}

function createWorkspaceSnapshot(
  documentBlocks: DocumentBlock[],
  documentVersions: DocumentVersionSnapshot[],
  activeVersionId: string | null,
): StoredWorkspaceSnapshot {
  return {
    schemaVersion: 1,
    activeVersionId,
    documentBlocks: cloneDocumentBlocksFrom(documentBlocks),
    documentVersions: documentVersions.map(cloneVersionSnapshot),
  }
}

function parseDocumentBlocks(parsed: unknown): DocumentBlock[] | null {
  if (!Array.isArray(parsed)) return null

  const valid = parsed.every(block => (
      block
      && typeof block === 'object'
      && typeof (block as DocumentBlock).id === 'string'
      && ((block as DocumentBlock).type === 'heading' || (block as DocumentBlock).type === 'paragraph')
      && typeof (block as DocumentBlock).content === 'string'
  ))

  return valid ? (parsed as DocumentBlock[]).map(cloneDocumentBlock) : null
}

function parseStoredBlocks(value: string | null): DocumentBlock[] | null {
  if (!value) return null

  try {
    return parseDocumentBlocks(JSON.parse(value) as unknown)
  } catch {
    return null
  }
}

function parseVersionSnapshots(parsed: unknown): DocumentVersionSnapshot[] | null {
  if (!Array.isArray(parsed)) return null

  const versions = parsed.map((version): DocumentVersionSnapshot | null => {
    if (!version || typeof version !== 'object') return null

    const candidate = version as DocumentVersionSnapshot
    const documentBlocks = parseDocumentBlocks(candidate.documentBlocks)
    const hasRequiredFields = (
      typeof candidate.id === 'string'
      && typeof candidate.label === 'string'
      && typeof candidate.summary === 'string'
      && typeof candidate.updatedAt === 'string'
      && typeof candidate.isCurrent === 'boolean'
      && typeof candidate.createdAt === 'string'
      && (candidate.suggestionId === undefined || typeof candidate.suggestionId === 'string')
      && (candidate.changeCount === undefined || typeof candidate.changeCount === 'number')
      && documentBlocks !== null
    )

    if (!hasRequiredFields || !documentBlocks) return null

    return {
      id: candidate.id,
      label: candidate.label,
      summary: candidate.summary,
      updatedAt: candidate.updatedAt,
      isCurrent: candidate.isCurrent,
      createdAt: candidate.createdAt,
      suggestionId: candidate.suggestionId,
      changeCount: candidate.changeCount,
      documentBlocks,
    }
  })

  if (versions.some(version => version === null)) return null

  return versions as DocumentVersionSnapshot[]
}

function parseStoredWorkspaceSnapshot(value: string | null): StoredWorkspaceSnapshot | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<StoredWorkspaceSnapshot>
    const documentBlocks = parseDocumentBlocks(parsed.documentBlocks)
    const documentVersions = parseVersionSnapshots(parsed.documentVersions)

    if (
      parsed.schemaVersion !== 1
      || !documentBlocks
      || !documentVersions
      || (parsed.activeVersionId !== null && typeof parsed.activeVersionId !== 'string')
    ) {
      return null
    }

    return {
      schemaVersion: 1,
      activeVersionId: parsed.activeVersionId ?? documentVersions[0]?.id ?? null,
      documentBlocks,
      documentVersions,
    }
  } catch {
    return null
  }
}

function firstParagraphBlock(blocks: DocumentBlock[]): DocumentBlock | null {
  return blocks.find(block => block.type === 'paragraph') ?? null
}

function createSuggestionFromGeneratedText(
  beforeBlocks: DocumentBlock[],
  generatedText: string,
  mode: AIRunMode = 'rewrite',
): DocumentSuggestion | null {
  const trimmed = generatedText.trim()
  const beforeBlock = beforeBlocks[0]
  if (!beforeBlock || !trimmed) return null

  const afterBlock = { ...cloneDocumentBlock(beforeBlock), content: trimmed }

  const isCitationEnhance = mode === 'citation_enhance'
  const reason = isCitationEnhance
    ? '根据真实 SSE 输出，已为该段落补充更充分的学术依据与引用支撑。'
    : '根据用户请求和真实 SSE 输出生成可审阅修改建议。'

  return {
    id: `sse-suggestion-${Date.now()}`,
    title: isCitationEnhance ? '引用增强建议' : 'AI 生成的修改建议',
    summary: isCitationEnhance
      ? '已为所选段落生成引用增强建议，请审阅后决定是否接受。'
      : '已根据真实 AI 输出生成一条可审阅的文档修改建议。',
    targetBlockIds: [beforeBlock.id],
    operation: 'replace_blocks',
    beforeBlocks: [cloneDocumentBlock(beforeBlock)],
    afterBlocks: [afterBlock],
    reason,
    confidence: isCitationEnhance ? 0.85 : 0.72,
    createdAt: new Date().toISOString(),
    changes: [{
      id: `sse-change-${beforeBlock.id}-${Date.now()}`,
      blockId: beforeBlock.id,
      type: 'modify',
      originalText: beforeBlock.content,
      revisedText: trimmed,
      reason,
    }],
    reasons: isCitationEnhance
      ? [
          reason,
          '引用增强模式：AI 保留原意的同时，补充可被文献支撑的学术表述。',
          '建议审阅新增表述是否与您的论文风格一致。',
        ]
      : [reason],
    reasoningSteps: isCitationEnhance
      ? [
          '识别目标段落中缺乏文献支撑的陈述。',
          '通过 GraphRAG 检索相关文献并匹配学术依据。',
          '在保持原意前提下重写段落，补充引用线索和学术表述。',
          '等待用户接受或拒绝后再更新正文。',
        ]
      : [
          '复用 /api/chat 的 SSE 流式输出。',
          '累积 token 并将结果包装为可审阅建议。',
          '等待用户接受或拒绝后再更新正文。',
        ],
  }
}

function buildUpdatedBlocksFromSuggestion(blocks: DocumentBlock[], suggestion: DocumentSuggestion): DocumentBlock[] {
  const afterBlocksById = new Map(suggestion.afterBlocks.map(block => [block.id, cloneDocumentBlock(block)]))
  const revisedTextById = new Map(suggestion.changes.map(change => [change.blockId, change.revisedText]))

  return blocks.map(block => {
    const afterBlock = afterBlocksById.get(block.id)
    if (afterBlock) return afterBlock

    const revisedText = revisedTextById.get(block.id)
    return revisedText ? { ...block, content: revisedText } : block
  })
}

function buildUpdatedBlocksFromChange(blocks: DocumentBlock[], change: SuggestionChange): DocumentBlock[] {
  return blocks.map(block => (
    block.id === change.blockId
      ? { ...cloneDocumentBlock(block), content: change.revisedText }
      : block
  ))
}

function filterSuggestionToChanges(suggestion: DocumentSuggestion, changes: SuggestionChange[]): DocumentSuggestion {
  const blockIds = new Set(changes.map(change => change.blockId))

  return {
    ...cloneSuggestion(suggestion),
    targetBlockIds: suggestion.targetBlockIds.filter(blockId => blockIds.has(blockId)),
    beforeBlocks: suggestion.beforeBlocks.filter(block => blockIds.has(block.id)).map(cloneDocumentBlock),
    afterBlocks: suggestion.afterBlocks.filter(block => blockIds.has(block.id)).map(cloneDocumentBlock),
    changes: changes.map(change => ({ ...change })),
    reasons: suggestion.reasons.filter(reason => changes.some(change => change.reason === reason)),
  }
}

function findFirstBlockIdByReferenceIds(blocks: DocumentBlock[], referenceIds: string[]): string | null {
  if (referenceIds.length === 0) return null

  return blocks.find(block => block.citations?.some(citation => referenceIds.includes(citation.referenceId)))?.id ?? null
}

function findFirstRelatedBlockId(blocks: DocumentBlock[], node: WorkspaceGraphNode): string | null {
  const explicitBlockId = node.blockIds?.find(blockId => blocks.some(block => block.id === blockId)) ?? null
  return explicitBlockId ?? findFirstBlockIdByReferenceIds(blocks, node.referenceIds)
}

function findReferenceIdForNodeSelection(
  blocks: DocumentBlock[],
  node: WorkspaceGraphNode,
  blockId: string | null,
): string | null {
  const selectedBlock = blockId ? blocks.find(block => block.id === blockId) : undefined
  const citedReferenceId = selectedBlock?.citations?.find(citation => (
    node.referenceIds.includes(citation.referenceId)
  ))?.referenceId

  return citedReferenceId ?? node.referenceIds[0] ?? null
}

function findBestNodeIdForReference(nodes: WorkspaceGraphNode[], referenceId: string): string | null {
  const matchingNodes = nodes.filter(node => node.referenceIds.includes(referenceId))
  return matchingNodes.find(node => node.type !== 'core')?.id ?? matchingNodes[0]?.id ?? null
}

function markCurrentVersion(versions: DocumentVersionSnapshot[], activeVersionId: string | null): DocumentVersionSnapshot[] {
  return versions.map(version => ({
    ...cloneVersionSnapshot(version),
    isCurrent: version.id === activeVersionId,
  }))
}

function selectedBlockStillExists(blocks: DocumentBlock[], selectedBlockId: string | null): boolean {
  return !!selectedBlockId && blocks.some(block => block.id === selectedBlockId)
}

function createAcceptedVersionSnapshot(
  suggestion: DocumentSuggestion,
  documentBlocks: DocumentBlock[],
  existingVersionCount: number,
): DocumentVersionSnapshot {
  return {
    id: `local-version-${Date.now()}`,
    label: `v3.${existingVersionCount}（当前）`,
    summary: suggestion.summary || suggestion.title || '接受 AI 修改生成的本地版本',
    updatedAt: '刚刚',
    isCurrent: true,
    createdAt: new Date().toISOString(),
    suggestionId: suggestion.id,
    changeCount: suggestion.changes.length,
    documentBlocks: cloneDocumentBlocksFrom(documentBlocks),
  }
}

function createRestoredDraftVersionSnapshot(documentBlocks: DocumentBlock[]): DocumentVersionSnapshot {
  return {
    id: `local-restored-${Date.now()}`,
    label: '本地草稿（当前）',
    summary: '从本地草稿恢复',
    updatedAt: '刚刚',
    isCurrent: true,
    createdAt: new Date().toISOString(),
    documentBlocks: cloneDocumentBlocksFrom(documentBlocks),
  }
}

function createRestoredOutlineBlocks(sessionId: string, finalOutline: string): DocumentBlock[] {
  return [
    {
      id: `outline-title-${sessionId}`,
      type: 'heading',
      headingLevel: 1,
      content: '恢复的研究提纲',
    },
    {
      id: `outline-body-${sessionId}`,
      type: 'paragraph',
      title: '历史会话提纲',
      content: finalOutline,
    },
  ]
}

function createRestoredSessionSuggestion(
  sessionId: string,
  messages: MessageItem[],
  documentBlocks: DocumentBlock[],
): DocumentSuggestion | null {
  const assistantMessage = [...messages].reverse().find(message => message.role === 'assistant')
  const targetBlock = firstParagraphBlock(documentBlocks)
  if (!assistantMessage || !targetBlock) return null

  return {
    id: `restored-session-suggestion-${sessionId}`,
    title: '恢复的 AI 建议',
    summary: assistantMessage.content,
    targetBlockIds: [targetBlock.id],
    operation: 'replace_blocks',
    beforeBlocks: [cloneDocumentBlock(targetBlock)],
    afterBlocks: [cloneDocumentBlock(targetBlock)],
    reason: '从历史会话消息恢复，用于继续审阅。',
    confidence: 0.7,
    createdAt: new Date().toISOString(),
    changes: [],
    reasons: ['历史会话恢复。'],
    reasoningSteps: messages.map(message => `${message.role}: ${message.content}`),
  }
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map(item => [item.id, item]))
  incoming.forEach(item => byId.set(item.id, item))
  return Array.from(byId.values())
}

function getCoreNodeId(nodes: WorkspaceGraphNode[]): string {
  return nodes.find(node => node.type === 'core')?.id ?? nodes[0]?.id ?? 'image-classification'
}

function buildDynamicGraphArtifacts(papers: PaperItem[], gaps: GapItem[], relatedBlockIds: string[] = []): {
  graphNodes: WorkspaceGraphNode[]
  graphEdges: WorkspaceGraphEdge[]
  references: ReferenceItem[]
} {
  const baseNodes = cloneGraphNodes()
  const coreNodeId = getCoreNodeId(baseNodes)

  const paperNodes: WorkspaceGraphNode[] = papers.map((paper, index) => ({
    id: `paper:${paper.id}`,
    label: paper.title ?? `检索文献 ${paper.id}`,
    type: 'paper',
    description: `${formatYear(paper.year)} · ${formatScore(paper.score)}`,
    referenceIds: [paper.id],
    blockIds: relatedBlockIds,
    position: { x: 610, y: 80 + index * 78 },
  }))

  const gapNodes: WorkspaceGraphNode[] = gaps.map((gap, index) => ({
    id: `gap:${gap.id}`,
    label: gap.description ?? `研究空白 ${gap.id}`,
    type: 'gap',
    description: `${severityLabel(gap.severity)} · ${formatAddressedBy(gap.addressed_by)} · ${formatScore(gap.score)}`,
    referenceIds: [],
    blockIds: relatedBlockIds,
    position: { x: 610, y: 300 + index * 82 },
  }))

  return {
    graphNodes: [...baseNodes, ...paperNodes, ...gapNodes],
    graphEdges: [
      ...cloneGraphEdges(),
      ...papers.map((paper): WorkspaceGraphEdge => ({
        id: `edge-paper-${paper.id}`,
        source: `paper:${paper.id}`,
        target: coreNodeId,
        label: '相关文献',
      })),
      ...gaps.map((gap): WorkspaceGraphEdge => ({
        id: `edge-gap-${gap.id}`,
        source: `gap:${gap.id}`,
        target: coreNodeId,
        label: '研究空白',
      })),
    ],
    references: [
      ...cloneReferences(),
      ...papers.map((paper): ReferenceItem => ({
        id: paper.id,
        title: paper.title ?? `检索文献 ${paper.id}`,
        year: paper.year,
        score: paper.score,
      })),
    ],
  }
}

function formatYear(year: number | undefined): string {
  return typeof year === 'number' ? `${year}` : '年份未知'
}

function formatScore(score: number | undefined): string {
  return typeof score === 'number' ? `相关度 ${Math.round(score * 100)}%` : '相关度待补充'
}

function formatAddressedBy(addressedBy: number | undefined): string {
  if (typeof addressedBy !== 'number') return '暂无填补文献统计'
  return addressedBy === 0 ? '暂无文献填补' : `${addressedBy} 篇文献涉及`
}

function severityLabel(severity: GapItem['severity']): string {
  if (!severity) return '暂无风险等级'

  switch (severity) {
    case 'high':
      return '高风险空白'
    case 'medium':
      return '中等空白'
    case 'low':
      return '低风险空白'
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  ...initialWorkspaceState(),

  setActiveConversation: (id) => set({ activeConversationId: id }),
  setActiveVersion: (id) => set((state) => {
    const selectedVersion = state.documentVersions.find(version => version.id === id)
    if (!selectedVersion) return state

    const documentBlocks = cloneDocumentBlocksFrom(selectedVersion.documentBlocks)
    const documentVersions = markCurrentVersion(state.documentVersions, id)
    const persisted = persistWorkspaceSnapshot(createWorkspaceSnapshot(documentBlocks, documentVersions, id))

    return {
      activeVersionId: id,
      documentBlocks,
      documentVersions,
      currentSuggestion: null,
      currentChangeIndex: 0,
      previewVersionId: null,
      isRestoringVersion: false,
      selectedBlockId: selectedBlockStillExists(documentBlocks, state.selectedBlockId) ? state.selectedBlockId : null,
      saveStatus: persisted ? 'local-saved' : 'modified',
    }
  }),
  startVersionPreview: (id) => set((state) => {
    const selectedVersion = state.documentVersions.find(version => version.id === id)
    if (!selectedVersion || selectedVersion.isCurrent) return state

    return {
      previewVersionId: id,
      isRestoringVersion: false,
    }
  }),
  cancelVersionPreview: () => set({
    previewVersionId: null,
    isRestoringVersion: false,
  }),
  restorePreviewVersion: () => set((state) => {
    if (!state.previewVersionId) return state

    const selectedVersion = state.documentVersions.find(version => version.id === state.previewVersionId)
    if (!selectedVersion) {
      return {
        previewVersionId: null,
        isRestoringVersion: false,
      }
    }

    const documentBlocks = cloneDocumentBlocksFrom(selectedVersion.documentBlocks)
    const documentVersions = markCurrentVersion(state.documentVersions, selectedVersion.id)
    const persisted = persistWorkspaceSnapshot(createWorkspaceSnapshot(documentBlocks, documentVersions, selectedVersion.id))
    const changedCount = changedVersionBlocks(state.documentBlocks, selectedVersion.documentBlocks).length
    const lastRestoreNotice: RestoreNotice = {
      versionTitle: selectedVersion.label,
      changedBlockCount: changedCount,
      restoredAt: new Date().toISOString(),
    }

    return {
      activeVersionId: selectedVersion.id,
      documentBlocks,
      documentVersions,
      currentSuggestion: null,
      currentChangeIndex: 0,
      previewVersionId: null,
      isRestoringVersion: false,
      selectedBlockId: selectedBlockStillExists(documentBlocks, state.selectedBlockId) ? state.selectedBlockId : null,
      saveStatus: persisted ? 'local-saved' : 'modified',
      lastRestoreNotice,
    }
  }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  restoreSession: async (id) => {
    set({ aiRunStatus: 'retrieving', restoreSessionNotice: '正在恢复历史会话...' })
    try {
      const [messagesResponse, artifact] = await Promise.all([
        fetchSessionMessages(id),
        fetchSessionArtifact(id),
      ])
      const papers = artifact.papers ?? []
      const gaps = artifact.gaps ?? []
      const documentBlocks = artifact.final_outline
        ? createRestoredOutlineBlocks(id, artifact.final_outline)
        : cloneDocumentBlocksFrom(get().documentBlocks)
      const documentVersions = artifact.final_outline
        ? [createRestoredDraftVersionSnapshot(documentBlocks), ...get().documentVersions.slice(0, MAX_LOCAL_VERSION_SNAPSHOTS - 1)]
        : get().documentVersions.map(cloneVersionSnapshot)
      const activeVersionId = documentVersions[0]?.id ?? get().activeVersionId
      const artifacts = buildDynamicGraphArtifacts(papers, gaps, documentBlocks.map(block => block.id))
      const currentSuggestion = createRestoredSessionSuggestion(id, messagesResponse.messages, documentBlocks)
      const persisted = persistWorkspaceSnapshot(createWorkspaceSnapshot(documentBlocks, documentVersions, activeVersionId))

      set({
        activeSessionId: id,
        restoredMessages: messagesResponse.messages,
        ragPapers: papers.map(clonePaper),
        ragGaps: gaps.map(cloneGap),
        documentBlocks,
        documentVersions,
        activeVersionId,
        currentSuggestion,
        currentChangeIndex: 0,
        graphNodes: artifacts.graphNodes,
        graphEdges: artifacts.graphEdges,
        references: artifacts.references,
        selectedBlockId: documentBlocks[0]?.id ?? null,
        saveStatus: persisted ? 'local-saved' : 'modified',
        aiRunStatus: 'done',
        aiStageLabel: '历史会话已恢复',
        restoreSessionNotice: '已完整恢复历史会话，可继续生成修改建议',
      })
    } catch {
      set({
        aiRunStatus: 'error',
        aiStageLabel: '历史会话恢复失败',
        restoreSessionNotice: '历史会话恢复失败，请重试',
      })
    }
  },
  setSelectedGraphNode: (id) => set((state) => {
    const selectedNode = state.graphNodes.find(node => node.id === id)
    const relatedBlockId = selectedNode ? findFirstRelatedBlockId(state.documentBlocks, selectedNode) : null
    const selectedReferenceId = selectedNode
      ? findReferenceIdForNodeSelection(state.documentBlocks, selectedNode, relatedBlockId)
      : null

    return {
      selectedGraphNodeId: id,
      selectedReferenceId,
      selectedBlockId: relatedBlockId ?? state.selectedBlockId,
    }
  }),
  selectCitationReference: (referenceId, blockId) => set((state) => {
    const selectedGraphNodeId = findBestNodeIdForReference(state.graphNodes, referenceId)

    return {
      selectedGraphNodeId: selectedGraphNodeId ?? state.selectedGraphNodeId,
      selectedReferenceId: referenceId,
      selectedBlockId: blockId,
      rightPanelMode: 'graph',
    }
  }),
  setSelectedBlock: (id) => set({ selectedBlockId: id }),
  setRightPanelMode: (mode) => set({ rightPanelMode: mode }),
  setAIRunStatus: (status) => set({ aiRunStatus: status }),
  setAIStage: (status, label) => set({ aiRunStatus: status, aiStageLabel: label }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  loadDocument: async (documentId) => {
    set({ saveStatus: 'saving', documentErrorMessage: '' })
    try {
      const [document, versions] = await Promise.all([
        fetchDocument(documentId),
        fetchDocumentVersions(documentId),
      ])
      const activeVersionId = versions[0]?.id ?? null
      set({
        activeDocumentId: document.id,
        activeVersionId,
        documentBlocks: documentBlocksFromApi(document),
        documentVersions: versions.map((version, index) => versionSnapshotFromApi(version, index === 0)),
        currentSuggestion: null,
        currentChangeIndex: 0,
        previewVersionId: null,
        isRestoringVersion: false,
        saveStatus: 'saved',
        documentErrorMessage: '',
      })
    } catch (error) {
      set({
        saveStatus: 'modified',
        documentErrorMessage: messageFromError(error),
      })
    }
  },
  saveCurrentDocument: async () => {
    const state = get()
    const title = documentTitleFromBlocks(state.documentBlocks)
    const blocks = cloneDocumentBlocksFrom(state.documentBlocks)
    set({ saveStatus: 'saving', documentErrorMessage: '' })

    try {
      const document = state.activeDocumentId
        ? await updateDocument(state.activeDocumentId, { title, blocks })
        : await createDocument({ title, blocks })
      set({
        activeDocumentId: document.id,
        documentBlocks: documentBlocksFromApi(document),
        saveStatus: 'saved',
        documentErrorMessage: '',
      })
    } catch (error) {
      const persisted = persistWorkspaceSnapshot(createWorkspaceSnapshot(
        state.documentBlocks,
        state.documentVersions,
        state.activeVersionId,
      ))
      set({
        saveStatus: persisted ? 'local-saved' : 'modified',
        documentErrorMessage: messageFromError(error),
      })
    }
  },
  createCurrentDocumentVersion: async (label) => {
    const documentId = get().activeDocumentId
    if (!documentId) {
      set({
        saveStatus: 'modified',
        documentErrorMessage: '当前文档尚未连接到后端',
      })
      return
    }

    set({ saveStatus: 'saving', documentErrorMessage: '' })
    try {
      const version = await createBackendDocumentVersion(documentId, label)
      const snapshot = versionSnapshotFromApi(version, true)
      set((state) => ({
        activeVersionId: snapshot.id,
        documentVersions: [
          snapshot,
          ...state.documentVersions.map(existing => ({ ...cloneVersionSnapshot(existing), isCurrent: false })),
        ].slice(0, MAX_LOCAL_VERSION_SNAPSHOTS),
        saveStatus: 'saved',
        documentErrorMessage: '',
      }))
    } catch (error) {
      set({
        saveStatus: 'modified',
        documentErrorMessage: messageFromError(error),
      })
    }
  },
  restoreDocumentVersion: async (versionId) => {
    const documentId = get().activeDocumentId
    if (!documentId) {
      set({
        saveStatus: 'modified',
        documentErrorMessage: '当前文档尚未连接到后端',
      })
      return
    }

    set({ isRestoringVersion: true, saveStatus: 'saving', documentErrorMessage: '' })
    try {
      const beforeBlocks = get().documentBlocks
      const document = await restoreBackendDocumentVersion(documentId, versionId)
      const documentBlocks = documentBlocksFromApi(document)
      const changedBlockCount = changedVersionBlocks(beforeBlocks, documentBlocks).length
      set((state) => ({
        documentBlocks,
        activeVersionId: versionId,
        documentVersions: markCurrentVersion(state.documentVersions, versionId),
        currentSuggestion: null,
        currentChangeIndex: 0,
        previewVersionId: null,
        isRestoringVersion: false,
        selectedBlockId: selectedBlockStillExists(documentBlocks, state.selectedBlockId) ? state.selectedBlockId : null,
        saveStatus: 'saved',
        documentErrorMessage: '',
        lastRestoreNotice: {
          versionTitle: state.documentVersions.find(version => version.id === versionId)?.label ?? '后端版本',
          changedBlockCount,
          restoredAt: new Date().toISOString(),
        },
      }))
    } catch (error) {
      set({
        isRestoringVersion: false,
        saveStatus: 'modified',
        documentErrorMessage: messageFromError(error),
      })
    }
  },
  setRestoreSessionNotice: (notice) => set({ restoreSessionNotice: notice }),
  dismissRestoreNotice: () => set({ lastRestoreNotice: null }),
  setCurrentSuggestion: (suggestion) => set({
    currentSuggestion: suggestion ? cloneSuggestion(suggestion) : null,
    currentChangeIndex: 0,
  }),
  requestCitationEnhancement: (blockId) => set({
    selectedBlockId: blockId,
    rightPanelMode: 'graph',
    citationEnhancementRequest: {
      id: `citation-enhancement-${blockId}-${Date.now()}`,
      blockId,
    },
  }),
  setCurrentChangeIndex: (index) => set((state) => {
    const maxIndex = Math.max((state.currentSuggestion?.changes.length ?? 1) - 1, 0)
    return { currentChangeIndex: Math.min(Math.max(index, 0), maxIndex) }
  }),
  nextChange: () => set((state) => {
    const maxIndex = Math.max((state.currentSuggestion?.changes.length ?? 1) - 1, 0)
    return { currentChangeIndex: Math.min(state.currentChangeIndex + 1, maxIndex) }
  }),
  previousChange: () => set((state) => ({
    currentChangeIndex: Math.max(state.currentChangeIndex - 1, 0),
  })),
  startAIRun: (targetBlockIdOverride?: string) => {
    let targetBlock: DocumentBlock | null = null

    set((state) => {
      targetBlock = (targetBlockIdOverride
        ? state.documentBlocks.find(block => block.id === targetBlockIdOverride && block.type === 'paragraph')
        : null)
        ?? state.documentBlocks.find(block => block.id === state.selectedBlockId && block.type === 'paragraph')
        ?? firstParagraphBlock(state.documentBlocks)

      return {
        aiRunStatus: 'retrieving',
        aiStageLabel: '正在检索',
        aiErrorMessage: '',
        generatedText: '',
        currentSuggestion: null,
        currentChangeIndex: 0,
        aiRunMode: 'rewrite',
        pendingBeforeBlocks: targetBlock ? [cloneDocumentBlock(targetBlock)] : [],
        ragPapers: [],
        ragGaps: [],
        graphNodes: cloneGraphNodes(),
        graphEdges: cloneGraphEdges(),
        references: cloneReferences(),
      }
    })

    return targetBlock ? cloneDocumentBlock(targetBlock) : null
  },
  startCitationEnhancement: (blockId: string) => {
    let targetBlock: DocumentBlock | null = null

    set((state) => {
      targetBlock = state.documentBlocks.find(block => block.id === blockId && block.type === 'paragraph')
        ?? firstParagraphBlock(state.documentBlocks)

      return {
        aiRunStatus: 'retrieving',
        aiStageLabel: '正在检索文献支撑',
        aiErrorMessage: '',
        generatedText: '',
        currentSuggestion: null,
        currentChangeIndex: 0,
        aiRunMode: 'citation_enhance',
        selectedBlockId: targetBlock?.id ?? state.selectedBlockId,
        pendingBeforeBlocks: targetBlock ? [cloneDocumentBlock(targetBlock)] : [],
        ragPapers: [],
        ragGaps: [],
        graphNodes: cloneGraphNodes(),
        graphEdges: cloneGraphEdges(),
        references: cloneReferences(),
      }
    })

    return targetBlock ? cloneDocumentBlock(targetBlock) : null
  },
  appendGeneratedToken: (token) => set((state) => ({
    generatedText: state.generatedText + token,
    aiRunStatus: 'generating',
    aiStageLabel: '正在生成',
  })),
  finishAIRunAsSuggestion: () => set((state) => {
    const suggestion = createSuggestionFromGeneratedText(
      state.pendingBeforeBlocks,
      state.generatedText,
      state.aiRunMode,
    )

    if (!suggestion) {
      return {
        aiRunStatus: 'error',
        aiStageLabel: 'AI 生成失败',
        aiErrorMessage: 'AI 未返回可用于改写的文本',
        currentSuggestion: null,
        currentChangeIndex: 0,
        aiRunMode: 'rewrite' as AIRunMode,
        pendingBeforeBlocks: [],
      }
    }

    return {
      aiRunStatus: 'done',
      aiStageLabel: state.aiRunMode === 'citation_enhance' ? '引用增强完成' : '生成完成',
      aiErrorMessage: '',
      currentSuggestion: suggestion,
      currentChangeIndex: 0,
      aiRunMode: 'rewrite' as AIRunMode,
      pendingBeforeBlocks: [],
    }
  }),
  failAIRunWithFallback: (message) => set({
    aiRunStatus: 'error',
    aiStageLabel: 'AI 生成失败',
    aiErrorMessage: message,
    currentSuggestion: null,
    currentChangeIndex: 0,
    aiRunMode: 'rewrite' as AIRunMode,
    pendingBeforeBlocks: [],
  }),
  cancelAIRun: () => set({
    aiRunStatus: 'canceled',
    aiStageLabel: '已停止生成',
    aiErrorMessage: '',
    generatedText: '',
    currentSuggestion: null,
    currentChangeIndex: 0,
    aiRunMode: 'rewrite' as AIRunMode,
    pendingBeforeBlocks: [],
  }),
  upsertRagPapers: (papers) => set((state) => {
    const ragPapers = mergeById(state.ragPapers, papers.map(clonePaper))
    const relatedBlockIds = state.pendingBeforeBlocks.map(block => block.id)
    const artifacts = buildDynamicGraphArtifacts(ragPapers, state.ragGaps, relatedBlockIds)

    return {
      ragPapers,
      ...artifacts,
    }
  }),
  upsertRagGaps: (gaps) => set((state) => {
    const ragGaps = mergeById(state.ragGaps, gaps.map(cloneGap))
    const relatedBlockIds = state.pendingBeforeBlocks.map(block => block.id)
    const artifacts = buildDynamicGraphArtifacts(state.ragPapers, ragGaps, relatedBlockIds)

    return {
      ragGaps,
      ...artifacts,
    }
  }),
  upsertReferences: (references) => set((state) => ({
    references: mergeById(state.references, references.map(reference => ({
      id: reference.id,
      title: reference.title ?? reference.source ?? `引用来源 ${reference.id}`,
      year: reference.year,
      venue: reference.source,
      score: reference.score,
      excerpt: reference.excerpt,
      url: reference.url,
    }))),
  })),
  clearRagArtifacts: () => set({
    ragPapers: [],
    ragGaps: [],
    graphNodes: cloneGraphNodes(),
    graphEdges: cloneGraphEdges(),
    references: cloneReferences(),
  }),
  acceptCurrentChange: () => {
    let shouldSaveBackend = false
    set((state) => {
      if (!state.currentSuggestion) return state

      const acceptedChange = state.currentSuggestion.changes[state.currentChangeIndex]
      if (!acceptedChange) return state

      const documentBlocks = buildUpdatedBlocksFromChange(state.documentBlocks, acceptedChange)
      const acceptedSuggestion = filterSuggestionToChanges(state.currentSuggestion, [acceptedChange])
      const remainingChanges = state.currentSuggestion.changes.filter(change => change.id !== acceptedChange.id)
      const currentSuggestion = remainingChanges.length > 0
        ? filterSuggestionToChanges(state.currentSuggestion, remainingChanges)
        : null
      const currentChangeIndex = currentSuggestion
        ? Math.min(state.currentChangeIndex, currentSuggestion.changes.length - 1)
        : 0
      const newVersion = createAcceptedVersionSnapshot(
        acceptedSuggestion,
        documentBlocks,
        state.documentVersions.length,
      )
      const documentVersions = [
        newVersion,
        ...state.documentVersions.map(version => ({ ...cloneVersionSnapshot(version), isCurrent: false })),
      ].slice(0, MAX_LOCAL_VERSION_SNAPSHOTS)
      shouldSaveBackend = Boolean(state.activeDocumentId)
      const persisted = shouldSaveBackend
        ? false
        : persistWorkspaceSnapshot(createWorkspaceSnapshot(documentBlocks, documentVersions, newVersion.id))

      return {
        documentBlocks,
        documentVersions,
        currentSuggestion,
        currentChangeIndex,
        aiRunStatus: 'done',
        aiStageLabel: currentSuggestion ? '局部修改已接受' : '生成完成',
        saveStatus: shouldSaveBackend ? 'saving' : persisted ? 'local-saved' : 'modified',
        activeVersionId: newVersion.id,
      }
    })
    if (shouldSaveBackend) void get().saveCurrentDocument()
  },
  acceptSuggestion: () => {
    let shouldSaveBackend = false
    set((state) => {
      if (!state.currentSuggestion) return state

      const documentBlocks = buildUpdatedBlocksFromSuggestion(state.documentBlocks, state.currentSuggestion)
      const newVersion = createAcceptedVersionSnapshot(
        state.currentSuggestion,
        documentBlocks,
        state.documentVersions.length,
      )
      const documentVersions = [
        newVersion,
        ...state.documentVersions.map(version => ({ ...cloneVersionSnapshot(version), isCurrent: false })),
      ].slice(0, MAX_LOCAL_VERSION_SNAPSHOTS)
      shouldSaveBackend = Boolean(state.activeDocumentId)
      const persisted = shouldSaveBackend
        ? false
        : persistWorkspaceSnapshot(createWorkspaceSnapshot(documentBlocks, documentVersions, newVersion.id))

      return {
        documentBlocks,
        documentVersions,
        currentSuggestion: null,
        currentChangeIndex: 0,
        aiRunStatus: 'done',
        aiStageLabel: '生成完成',
        saveStatus: shouldSaveBackend ? 'saving' : persisted ? 'local-saved' : 'modified',
        activeVersionId: newVersion.id,
      }
    })
    if (shouldSaveBackend) void get().saveCurrentDocument()
  },
  rejectSuggestion: () => set({
    currentSuggestion: null,
    currentChangeIndex: 0,
    aiRunStatus: 'idle',
    aiStageLabel: '',
    aiErrorMessage: '',
    aiRunMode: 'rewrite' as AIRunMode,
  }),
  hydrateLocalDraft: () => set((state) => {
    const storage = getLocalStorage()
    const snapshot = parseStoredWorkspaceSnapshot(storage?.getItem(WORKBENCH_SNAPSHOT_KEY) ?? null)

    if (snapshot) {
      const activeVersionId = snapshot.documentVersions.some(version => version.id === snapshot.activeVersionId)
        ? snapshot.activeVersionId
        : snapshot.documentVersions[0]?.id ?? null

      return {
        activeVersionId,
        documentBlocks: cloneDocumentBlocksFrom(snapshot.documentBlocks),
        documentVersions: markCurrentVersion(snapshot.documentVersions, activeVersionId),
        saveStatus: 'local-saved',
      }
    }

    const blocks = parseStoredBlocks(storage?.getItem(WORKBENCH_DRAFT_KEY) ?? null)
    if (!blocks) return state

    const restoredVersion = createRestoredDraftVersionSnapshot(blocks)
    const documentVersions = [
      restoredVersion,
      ...state.documentVersions.map(version => ({ ...cloneVersionSnapshot(version), isCurrent: false })),
    ].slice(0, MAX_LOCAL_VERSION_SNAPSHOTS)
    const persisted = persistWorkspaceSnapshot(createWorkspaceSnapshot(blocks, documentVersions, restoredVersion.id))

    return {
      documentBlocks: blocks,
      documentVersions,
      activeVersionId: restoredVersion.id,
      saveStatus: persisted ? 'local-saved' : 'modified',
    }
  }),
  resetWorkspace: () => set(initialWorkspaceState()),
}))
