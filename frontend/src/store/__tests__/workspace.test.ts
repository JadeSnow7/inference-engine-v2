import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkspaceStore } from '../workspace'
import { aiSuggestion } from '../../mocks/workspaceMock'
import type { DocumentSuggestion, ReviewItem } from '../../types/workspace'

const fetchSessionMessages = vi.hoisted(() => vi.fn())
const fetchSessionArtifact = vi.hoisted(() => vi.fn())
const fetchDocument = vi.hoisted(() => vi.fn())
const updateDocument = vi.hoisted(() => vi.fn())
const fetchDocumentVersions = vi.hoisted(() => vi.fn())
const createDocumentVersion = vi.hoisted(() => vi.fn())
const restoreDocumentVersion = vi.hoisted(() => vi.fn())
const fetchReviewItems = vi.hoisted(() => vi.fn())
const createReviewItem = vi.hoisted(() => vi.fn())
const updateReviewItem = vi.hoisted(() => vi.fn())

vi.mock('../../api/sessions', () => ({
  fetchSessionMessages: (...args: unknown[]) => fetchSessionMessages(...args),
  fetchSessionArtifact: (...args: unknown[]) => fetchSessionArtifact(...args),
}))

vi.mock('../../api/documents', () => ({
  fetchDocument: (...args: unknown[]) => fetchDocument(...args),
  updateDocument: (...args: unknown[]) => updateDocument(...args),
  fetchDocumentVersions: (...args: unknown[]) => fetchDocumentVersions(...args),
  createDocumentVersion: (...args: unknown[]) => createDocumentVersion(...args),
  restoreDocumentVersion: (...args: unknown[]) => restoreDocumentVersion(...args),
}))

vi.mock('../../api/reviewItems', () => ({
  fetchReviewItems: (...args: unknown[]) => fetchReviewItems(...args),
  createReviewItem: (...args: unknown[]) => createReviewItem(...args),
  updateReviewItem: (...args: unknown[]) => updateReviewItem(...args),
}))

const WORKBENCH_DRAFT_KEY = 'workbench:documentBlocks:v1'
const WORKBENCH_SNAPSHOT_KEY = 'workbench:workspaceSnapshot:v1'

function makeReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id: 'review-1',
    documentId: 'doc-1',
    source: 'document_tool',
    kind: 'rewrite',
    status: 'pending',
    targetBlockIds: ['b1'],
    beforeBlocks: [],
    afterBlocks: [],
    changes: [],
    reason: 'Improve clarity',
    evidenceIds: [],
    versionBeforeId: null,
    versionAfterId: null,
    createdAt: '2026-05-15T00:00:00Z',
    updatedAt: '2026-05-15T00:00:00Z',
    ...overrides,
  }
}

function installMemoryStorage(options: { throwOnSet?: boolean } = {}) {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (options.throwOnSet) throw new Error('quota exceeded')
      values.set(key, value)
    },
    removeItem: (key: string) => values.delete(key),
  })
}

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    installMemoryStorage()
    window.localStorage.removeItem(WORKBENCH_DRAFT_KEY)
    window.localStorage.removeItem(WORKBENCH_SNAPSHOT_KEY)
    fetchDocument.mockReset()
    updateDocument.mockReset()
    fetchDocumentVersions.mockReset()
    createDocumentVersion.mockReset()
    restoreDocumentVersion.mockReset()
    fetchReviewItems.mockReset()
    createReviewItem.mockReset()
    updateReviewItem.mockReset()
    fetchReviewItems.mockResolvedValue({ items: [] })
    createReviewItem.mockImplementation(async (item: ReviewItem) => item)
    updateReviewItem.mockImplementation(async (_id: string, input: Partial<ReviewItem> & { documentId: string }) => makeReviewItem({ id: _id, ...input }))
    vi.useRealTimers()
    useWorkspaceStore.getState().resetWorkspace()
  })

  it('defaults and resets the right panel to review mode', () => {
    const store = useWorkspaceStore.getState()

    expect(store.rightPanelMode).toBe('review')

    store.setRightPanelMode('evidence')
    store.resetWorkspace()

    expect(useWorkspaceStore.getState().rightPanelMode).toBe('review')
  })

  it('tracks active workspace selections', () => {
    const store = useWorkspaceStore.getState()

    store.setActiveConversation('conv-review')
    store.setActiveVersion('v3-1')
    store.setSelectedGraphNode('cnn')
    store.setSelectedBlock('block-related-work')
    store.setRightPanelMode('evidence')
    store.setAIRunStatus('reasoning')

    expect(useWorkspaceStore.getState().activeConversationId).toBe('conv-review')
    expect(useWorkspaceStore.getState().activeVersionId).toBe('v3-1')
    expect(useWorkspaceStore.getState().selectedGraphNodeId).toBe('cnn')
    expect(useWorkspaceStore.getState().selectedBlockId).toBe('block-related-work')
    expect(useWorkspaceStore.getState().rightPanelMode).toBe('evidence')
    expect(useWorkspaceStore.getState().aiRunStatus).toBe('reasoning')
  })

  it('acceptSuggestion applies all changed block content and clears suggestion', () => {
    useWorkspaceStore.getState().setCurrentSuggestion(aiSuggestion)
    useWorkspaceStore.getState().acceptSuggestion()

    const updatedBlock = useWorkspaceStore
      .getState()
      .documentBlocks.find(block => block.id === 'block-related-work')

    expect(updatedBlock?.content).toContain('依赖于手工设计的特征提取器')
    expect(updatedBlock?.content).toContain('泛化能力有限')
    expect(useWorkspaceStore.getState().currentSuggestion).toBeNull()
  })

  it('acceptCurrentChange applies only the selected change and keeps remaining changes reviewable', () => {
    useWorkspaceStore.getState().setCurrentSuggestion(aiSuggestion)
    useWorkspaceStore.getState().setCurrentChangeIndex(1)

    useWorkspaceStore.getState().acceptCurrentChange()

    const state = useWorkspaceStore.getState()
    const acceptedBlock = state.documentBlocks.find(block => block.id === 'block-intro-2')
    const untouchedBlock = state.documentBlocks.find(block => block.id === 'block-related-work')

    expect(acceptedBlock?.content).toContain('网络结构演进、训练数据规模')
    expect(untouchedBlock?.content).toBe(aiSuggestion.beforeBlocks.find(block => block.id === 'block-related-work')?.content)
    expect(state.currentSuggestion?.changes.map(change => change.id)).toEqual(['change-related-work', 'change-cnn-citation'])
    expect(state.currentSuggestion?.targetBlockIds).toEqual(['block-related-work', 'block-cnn'])
    expect(state.currentChangeIndex).toBe(1)
    expect(state.saveStatus).toBe('local-saved')
  })

  it('acceptSuggestion applies afterBlocks suggestions and persists a workspace snapshot version', () => {
    const beforeBlock = useWorkspaceStore
      .getState()
      .documentBlocks.find(block => block.type === 'paragraph')

    expect(beforeBlock).toBeDefined()

    const suggestion: DocumentSuggestion = {
      id: 'sse-suggestion-1',
      title: 'AI 生成的修改建议',
      summary: '已根据真实 SSE 输出生成建议。',
      targetBlockIds: [beforeBlock!.id],
      operation: 'replace_blocks',
      beforeBlocks: [{ ...beforeBlock! }],
      afterBlocks: [{ ...beforeBlock!, content: '真实 SSE 生成后的段落内容。' }],
      reason: '根据用户请求改写目标段落。',
      confidence: 0.76,
      createdAt: '2026-04-30T00:00:00.000Z',
      changes: [{
        id: 'sse-change-1',
        blockId: beforeBlock!.id,
        type: 'modify',
        originalText: beforeBlock!.content,
        revisedText: '真实 SSE 生成后的段落内容。',
        reason: '根据用户请求改写目标段落。',
      }],
      reasons: ['根据用户请求改写目标段落。'],
      reasoningSteps: ['接收真实 SSE 输出。'],
    }

    useWorkspaceStore.getState().setCurrentSuggestion(suggestion)
    useWorkspaceStore.getState().acceptSuggestion()

    const updatedBlock = useWorkspaceStore
      .getState()
      .documentBlocks.find(block => block.id === beforeBlock!.id)

    expect(updatedBlock?.content).toBe('真实 SSE 生成后的段落内容。')
    expect(useWorkspaceStore.getState().currentSuggestion).toBeNull()
    expect(useWorkspaceStore.getState().saveStatus).toBe('local-saved')
    expect(window.localStorage.getItem(WORKBENCH_DRAFT_KEY)).toBeNull()

    const storedSnapshot = JSON.parse(window.localStorage.getItem(WORKBENCH_SNAPSHOT_KEY) ?? '{}')
    expect(storedSnapshot.documentBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: beforeBlock!.id, content: '真实 SSE 生成后的段落内容。' }),
    ]))
    expect(storedSnapshot.documentVersions[0]).toEqual(expect.objectContaining({
      suggestionId: 'sse-suggestion-1',
      changeCount: 1,
      isCurrent: true,
    }))
    expect(storedSnapshot.documentVersions[0].documentBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: beforeBlock!.id, content: '真实 SSE 生成后的段落内容。' }),
    ]))
    expect(useWorkspaceStore.getState().documentVersions[0].suggestionId).toBe('sse-suggestion-1')
  })

  it('setActiveVersion switches document content to the selected version snapshot', () => {
    const initialBlock = useWorkspaceStore.getState().documentBlocks.find(block => block.type === 'paragraph')
    expect(initialBlock).toBeDefined()

    const suggestion: DocumentSuggestion = {
      id: 'version-switch-suggestion',
      title: 'AI 生成的修改建议',
      summary: '用于版本切换测试。',
      targetBlockIds: [initialBlock!.id],
      operation: 'replace_blocks',
      beforeBlocks: [{ ...initialBlock! }],
      afterBlocks: [{ ...initialBlock!, content: '版本切换后的新内容。' }],
      reason: '测试版本快照。',
      confidence: 0.8,
      createdAt: '2026-04-30T00:00:00.000Z',
      changes: [{
        id: 'version-switch-change',
        blockId: initialBlock!.id,
        type: 'modify',
        originalText: initialBlock!.content,
        revisedText: '版本切换后的新内容。',
        reason: '测试版本快照。',
      }],
      reasons: ['测试版本快照。'],
      reasoningSteps: ['创建本地版本快照。'],
    }

    useWorkspaceStore.getState().setCurrentSuggestion(suggestion)
    useWorkspaceStore.getState().acceptSuggestion()

    const newVersionId = useWorkspaceStore.getState().activeVersionId
    expect(useWorkspaceStore.getState().documentBlocks.find(block => block.id === initialBlock!.id)?.content)
      .toBe('版本切换后的新内容。')

    useWorkspaceStore.getState().setActiveVersion('v3-2')

    expect(useWorkspaceStore.getState().activeVersionId).toBe('v3-2')
    expect(useWorkspaceStore.getState().documentBlocks.find(block => block.id === initialBlock!.id)?.content)
      .toBe(initialBlock!.content)
    expect(useWorkspaceStore.getState().documentVersions.find(version => version.id === 'v3-2')?.isCurrent).toBe(true)
    expect(useWorkspaceStore.getState().documentVersions.find(version => version.id === newVersionId)?.isCurrent).toBe(false)
  })

  it('previews and cancels a version snapshot without changing document content', () => {
    const originalBlocks = useWorkspaceStore.getState().documentBlocks

    useWorkspaceStore.getState().startVersionPreview('v3-1')

    expect(useWorkspaceStore.getState().previewVersionId).toBe('v3-1')
    expect(useWorkspaceStore.getState().documentBlocks).toEqual(originalBlocks)

    useWorkspaceStore.getState().cancelVersionPreview()

    expect(useWorkspaceStore.getState().previewVersionId).toBeNull()
    expect(useWorkspaceStore.getState().documentBlocks).toEqual(originalBlocks)
  })

  it('restores a previewed version snapshot and clears pending review state', () => {
    const initialBlock = useWorkspaceStore.getState().documentBlocks.find(block => block.type === 'paragraph')
    expect(initialBlock).toBeDefined()

    useWorkspaceStore.getState().setCurrentSuggestion({
      id: 'restore-preview-suggestion',
      title: 'AI 生成的修改建议',
      summary: '用于恢复预览测试。',
      targetBlockIds: [initialBlock!.id],
      operation: 'replace_blocks',
      beforeBlocks: [{ ...initialBlock! }],
      afterBlocks: [{ ...initialBlock!, content: '等待恢复覆盖的当前内容。' }],
      reason: '测试恢复预览版本。',
      confidence: 0.8,
      createdAt: '2026-04-30T00:00:00.000Z',
      changes: [{
        id: 'restore-preview-change',
        blockId: initialBlock!.id,
        type: 'modify',
        originalText: initialBlock!.content,
        revisedText: '等待恢复覆盖的当前内容。',
        reason: '测试恢复预览版本。',
      }],
      reasons: ['测试恢复预览版本。'],
      reasoningSteps: ['创建一个待处理建议。'],
    })
    useWorkspaceStore.getState().acceptSuggestion()
    useWorkspaceStore.getState().setCurrentSuggestion(aiSuggestion)
    useWorkspaceStore.getState().setSelectedBlock('missing-after-restore')
    useWorkspaceStore.getState().startVersionPreview('v3-2')

    expect(useWorkspaceStore.getState().documentBlocks.find(block => block.id === initialBlock!.id)?.content)
      .toBe('等待恢复覆盖的当前内容。')

    useWorkspaceStore.getState().restorePreviewVersion()

    const restoredState = useWorkspaceStore.getState()
    expect(restoredState.activeVersionId).toBe('v3-2')
    expect(restoredState.previewVersionId).toBeNull()
    expect(restoredState.currentSuggestion).toBeNull()
    expect(restoredState.selectedBlockId).toBeNull()
    expect(restoredState.isRestoringVersion).toBe(false)
    expect(restoredState.documentBlocks.find(block => block.id === initialBlock!.id)?.content)
      .toBe(initialBlock!.content)
    expect(restoredState.documentVersions.filter(version => version.isCurrent)).toHaveLength(1)
    expect(restoredState.documentVersions.find(version => version.id === 'v3-2')?.isCurrent).toBe(true)
    expect(JSON.parse(window.localStorage.getItem(WORKBENCH_SNAPSHOT_KEY) ?? '{}').activeVersionId).toBe('v3-2')
  })

  it('rejectSuggestion clears the pending AI suggestion without changing document blocks', () => {
    const originalBlock = useWorkspaceStore
      .getState()
      .documentBlocks.find(block => block.id === 'block-related-work')

    useWorkspaceStore.getState().setCurrentSuggestion(aiSuggestion)
    useWorkspaceStore.getState().rejectSuggestion()

    const currentBlock = useWorkspaceStore
      .getState()
      .documentBlocks.find(block => block.id === 'block-related-work')

    expect(currentBlock?.content).toBe(originalBlock?.content)
    expect(useWorkspaceStore.getState().currentSuggestion).toBeNull()
  })

  it('cancelAIRun stops streaming without creating an accepted suggestion path', () => {
    const targetBlock = useWorkspaceStore.getState().startAIRun('请润色当前段落')

    expect(targetBlock).toBeDefined()

    useWorkspaceStore.getState().appendGeneratedToken('尚未完成的流式输出')
    useWorkspaceStore.getState().cancelAIRun()

    expect(useWorkspaceStore.getState().aiRunStatus).toBe('canceled')
    expect(useWorkspaceStore.getState().aiStageLabel).toBe('已停止生成')
    expect(useWorkspaceStore.getState().generatedText).toBe('')
    expect(useWorkspaceStore.getState().pendingBeforeBlocks).toEqual([])
    expect(useWorkspaceStore.getState().currentSuggestion).toBeNull()
  })

  it('stores SSE RAG papers and gaps as dynamic graph artifacts', () => {
    useWorkspaceStore.getState().upsertRagPapers([
      { id: 'paper-live-1', title: 'Live Paper', year: 2025, score: 0.93 },
    ])
    useWorkspaceStore.getState().upsertRagGaps([
      { id: 'gap-live-1', description: 'Live Gap', severity: 'high', addressed_by: 0, score: 0.87 },
    ])

    const state = useWorkspaceStore.getState()

    expect(state.ragPapers).toEqual([{ id: 'paper-live-1', title: 'Live Paper', year: 2025, score: 0.93 }])
    expect(state.ragGaps).toEqual([{ id: 'gap-live-1', description: 'Live Gap', severity: 'high', addressed_by: 0, score: 0.87 }])
    expect(state.graphNodes.some(node => node.id === 'paper:paper-live-1' && node.type === 'paper')).toBe(true)
    expect(state.graphNodes.some(node => node.id === 'gap:gap-live-1' && node.type === 'gap')).toBe(true)
    expect(state.references.some(reference => reference.id === 'paper-live-1' && reference.score === 0.93)).toBe(true)
  })

  it('restores session messages artifact papers gaps outline draft and suggestion from backend data', async () => {
    fetchSessionMessages.mockResolvedValue({
      messages: [
        { role: 'user', content: '请分析这篇课程文献。' },
        { role: 'assistant', content: '可以从研究问题、方法和证据三部分展开。' },
      ],
    })
    fetchSessionArtifact.mockResolvedValue({
      papers: [{ id: 'paper-restored', title: 'Restored Paper', year: 2026, score: 0.94 }],
      gaps: [{ id: 'gap-restored', description: '缺少课堂情境对照', severity: 'medium', addressed_by: 2, score: 0.72 }],
      final_outline: '一、研究背景\n二、文献综述\n三、研究空白',
    })

    await useWorkspaceStore.getState().restoreSession('sess-restored')

    const state = useWorkspaceStore.getState()
    expect(fetchSessionMessages).toHaveBeenCalledWith('sess-restored')
    expect(fetchSessionArtifact).toHaveBeenCalledWith('sess-restored')
    expect(state.activeSessionId).toBe('sess-restored')
    expect(state.ragPapers).toEqual([{ id: 'paper-restored', title: 'Restored Paper', year: 2026, score: 0.94 }])
    expect(state.ragGaps).toEqual([{ id: 'gap-restored', description: '缺少课堂情境对照', severity: 'medium', addressed_by: 2, score: 0.72 }])
    expect(state.documentBlocks.some(block => block.content.includes('研究背景'))).toBe(true)
    expect(state.currentSuggestion?.summary).toContain('可以从研究问题、方法和证据三部分展开')
    expect(state.restoreSessionNotice).toContain('已完整恢复历史会话')
  })

  it('clears previous RAG artifacts when a new AI run starts', () => {
    useWorkspaceStore.getState().upsertRagPapers([
      { id: 'paper-old', title: 'Old Paper', year: 2024, score: 0.8 },
    ])
    useWorkspaceStore.getState().upsertRagGaps([
      { id: 'gap-old', description: 'Old Gap', severity: 'medium', addressed_by: 1, score: 0.5 },
    ])

    useWorkspaceStore.getState().startAIRun('请改写当前段落')

    expect(useWorkspaceStore.getState().ragPapers).toEqual([])
    expect(useWorkspaceStore.getState().ragGaps).toEqual([])
    expect(useWorkspaceStore.getState().graphNodes.some(node => node.id === 'paper:paper-old')).toBe(false)
    expect(useWorkspaceStore.getState().graphNodes.some(node => node.id === 'gap:gap-old')).toBe(false)
  })

  it('hydrates a workspace snapshot before falling back to the old draft key', () => {
    const snapshotBlocks = useWorkspaceStore.getState().documentBlocks.map(block => (
      block.type === 'paragraph' ? { ...block, content: '从 workspace snapshot 恢复的内容。' } : block
    ))
    const legacyBlocks = useWorkspaceStore.getState().documentBlocks.map(block => (
      block.type === 'paragraph' ? { ...block, content: '不应优先恢复的旧草稿。' } : block
    ))
    const baseVersion = useWorkspaceStore.getState().documentVersions[0]

    window.localStorage.setItem(WORKBENCH_SNAPSHOT_KEY, JSON.stringify({
      schemaVersion: 1,
      activeVersionId: 'snapshot-version',
      documentBlocks: snapshotBlocks,
      documentVersions: [{
        ...baseVersion,
        id: 'snapshot-version',
        label: '本地快照',
        isCurrent: true,
        createdAt: '2026-04-30T00:00:00.000Z',
        documentBlocks: snapshotBlocks,
      }],
    }))
    window.localStorage.setItem(WORKBENCH_DRAFT_KEY, JSON.stringify(legacyBlocks))
    useWorkspaceStore.getState().hydrateLocalDraft()

    expect(useWorkspaceStore.getState().activeVersionId).toBe('snapshot-version')
    expect(useWorkspaceStore.getState().documentBlocks.some(block => block.content === '从 workspace snapshot 恢复的内容。')).toBe(true)
    expect(useWorkspaceStore.getState().documentBlocks.some(block => block.content === '不应优先恢复的旧草稿。')).toBe(false)
    expect(useWorkspaceStore.getState().documentVersions[0].documentBlocks.some(block => block.content === '从 workspace snapshot 恢复的内容。')).toBe(true)
    expect(useWorkspaceStore.getState().saveStatus).toBe('local-saved')
  })

  it('migrates the old local draft key into a current local version snapshot', () => {
    const storedBlocks = useWorkspaceStore.getState().documentBlocks.map(block => (
      block.type === 'paragraph' ? { ...block, content: '从 localStorage 恢复的内容。' } : block
    ))

    window.localStorage.setItem(WORKBENCH_DRAFT_KEY, JSON.stringify(storedBlocks))
    useWorkspaceStore.getState().hydrateLocalDraft()

    expect(useWorkspaceStore.getState().documentBlocks.some(block => block.content === '从 localStorage 恢复的内容。')).toBe(true)
    expect(useWorkspaceStore.getState().documentVersions[0].summary).toBe('从本地草稿恢复')
    expect(useWorkspaceStore.getState().documentVersions[0].documentBlocks.some(block => block.content === '从 localStorage 恢复的内容。')).toBe(true)
    expect(useWorkspaceStore.getState().saveStatus).toBe('local-saved')

    window.localStorage.removeItem(WORKBENCH_SNAPSHOT_KEY)
    window.localStorage.setItem(WORKBENCH_DRAFT_KEY, '{bad json')
    useWorkspaceStore.getState().resetWorkspace()
    useWorkspaceStore.getState().hydrateLocalDraft()

    expect(useWorkspaceStore.getState().documentBlocks.some(block => block.content === '从 localStorage 恢复的内容。')).toBe(false)
  })

  it('keeps in-memory accepted changes modified when local snapshot persistence fails', () => {
    installMemoryStorage({ throwOnSet: true })
    useWorkspaceStore.getState().resetWorkspace()

    const beforeBlock = useWorkspaceStore.getState().documentBlocks.find(block => block.type === 'paragraph')
    expect(beforeBlock).toBeDefined()

    useWorkspaceStore.getState().setCurrentSuggestion({
      id: 'persist-failure-suggestion',
      title: 'AI 生成的修改建议',
      summary: '用于持久化失败测试。',
      targetBlockIds: [beforeBlock!.id],
      operation: 'replace_blocks',
      beforeBlocks: [{ ...beforeBlock! }],
      afterBlocks: [{ ...beforeBlock!, content: '内存中仍应更新的内容。' }],
      reason: '测试本地存储失败。',
      confidence: 0.8,
      createdAt: '2026-04-30T00:00:00.000Z',
      changes: [{
        id: 'persist-failure-change',
        blockId: beforeBlock!.id,
        type: 'modify',
        originalText: beforeBlock!.content,
        revisedText: '内存中仍应更新的内容。',
        reason: '测试本地存储失败。',
      }],
      reasons: ['测试本地存储失败。'],
      reasoningSteps: ['模拟 localStorage 抛错。'],
    })
    useWorkspaceStore.getState().acceptSuggestion()

    expect(useWorkspaceStore.getState().documentBlocks.find(block => block.id === beforeBlock!.id)?.content)
      .toBe('内存中仍应更新的内容。')
    expect(useWorkspaceStore.getState().saveStatus).toBe('modified')
    expect(useWorkspaceStore.getState().documentVersions[0].suggestionId).toBe('persist-failure-suggestion')
  })

  // ─── P2-2: 版本恢复审计提示 ───────────────────────────────────────────────

  it('P2-2: restorePreviewVersion writes a lastRestoreNotice after successful restore', () => {
    useWorkspaceStore.getState().startVersionPreview('v3-1')
    useWorkspaceStore.getState().restorePreviewVersion()

    const notice = useWorkspaceStore.getState().lastRestoreNotice
    expect(notice).not.toBeNull()
  })

  it('P2-2: lastRestoreNotice contains the restored version label', () => {
    useWorkspaceStore.getState().startVersionPreview('v3-1')
    useWorkspaceStore.getState().restorePreviewVersion()

    const notice = useWorkspaceStore.getState().lastRestoreNotice
    expect(notice?.versionTitle).toBeTruthy()
    // v3-1 is one of the seeded mock versions — its label must appear in the notice
    const v31Label = useWorkspaceStore
      .getState()
      .documentVersions.find(v => v.id === 'v3-1')?.label ?? ''
    // After restore the version list is still available; label is set before set() completes
    // We recorded it at the time of restore, so it must match the mock label
    expect(typeof notice?.versionTitle).toBe('string')
    expect(notice!.versionTitle.length).toBeGreaterThan(0)
    // The notice title should equal the label of the version we just restored
    // (we re-check via the version we set active after restore)
    const restoredVersion = useWorkspaceStore
      .getState()
      .documentVersions.find(v => v.id === useWorkspaceStore.getState().activeVersionId)
    expect(notice?.versionTitle).toBe(restoredVersion?.label ?? v31Label)
  })

  it('P2-2: lastRestoreNotice contains changedBlockCount computed from diff', () => {
    // Seed a version with blocks that differ from current
    const currentBlocks = useWorkspaceStore.getState().documentBlocks
    const modifiedBlocks = currentBlocks.map(b =>
      b.type === 'paragraph' ? { ...b, content: b.content + ' (modified)' } : b
    )
    const versions = useWorkspaceStore.getState().documentVersions
    useWorkspaceStore.setState({
      documentVersions: versions.map(v =>
        v.id === 'v3-1' ? { ...v, documentBlocks: modifiedBlocks } : v
      ),
    })

    useWorkspaceStore.getState().startVersionPreview('v3-1')
    useWorkspaceStore.getState().restorePreviewVersion()

    const notice = useWorkspaceStore.getState().lastRestoreNotice
    expect(typeof notice?.changedBlockCount).toBe('number')
    expect(notice!.changedBlockCount).toBeGreaterThan(0)
  })

  it('P2-2: lastRestoreNotice contains a restoredAt ISO timestamp string', () => {
    const before = Date.now()
    useWorkspaceStore.getState().startVersionPreview('v3-1')
    useWorkspaceStore.getState().restorePreviewVersion()
    const after = Date.now()

    const notice = useWorkspaceStore.getState().lastRestoreNotice
    expect(notice?.restoredAt).toBeTruthy()
    const parsed = new Date(notice!.restoredAt).getTime()
    expect(parsed).toBeGreaterThanOrEqual(before)
    expect(parsed).toBeLessThanOrEqual(after)
  })

  it('P2-2: dismissRestoreNotice clears the notice', () => {
    useWorkspaceStore.getState().startVersionPreview('v3-1')
    useWorkspaceStore.getState().restorePreviewVersion()
    expect(useWorkspaceStore.getState().lastRestoreNotice).not.toBeNull()

    useWorkspaceStore.getState().dismissRestoreNotice()

    expect(useWorkspaceStore.getState().lastRestoreNotice).toBeNull()
  })

  it('P2-2: cancelVersionPreview does NOT set lastRestoreNotice', () => {
    useWorkspaceStore.getState().startVersionPreview('v3-1')
    useWorkspaceStore.getState().cancelVersionPreview()

    expect(useWorkspaceStore.getState().lastRestoreNotice).toBeNull()
  })

  it('P2-2: accepting and rejecting AI suggestions do not affect lastRestoreNotice', () => {
    // First, do a restore so the notice is set
    useWorkspaceStore.getState().startVersionPreview('v3-1')
    useWorkspaceStore.getState().restorePreviewVersion()
    const notice = useWorkspaceStore.getState().lastRestoreNotice
    expect(notice).not.toBeNull()

    // Accept a suggestion — notice must remain unchanged
    useWorkspaceStore.getState().setCurrentSuggestion(aiSuggestion)
    useWorkspaceStore.getState().acceptSuggestion()
    expect(useWorkspaceStore.getState().lastRestoreNotice).toEqual(notice)

    // Reject a suggestion — notice must remain unchanged
    useWorkspaceStore.getState().setCurrentSuggestion(aiSuggestion)
    useWorkspaceStore.getState().rejectSuggestion()
    expect(useWorkspaceStore.getState().lastRestoreNotice).toEqual(notice)
  })

  it('loads document blocks and versions from the backend document API', async () => {
    fetchDocument.mockResolvedValue({
      id: 'doc-1',
      title: 'Backend document',
      courseId: 'course-1',
      blocks: [
        { id: 'heading-1', type: 'heading', headingLevel: 1, content: 'Backend document' },
        { id: 'para-1', type: 'paragraph', content: 'Loaded from API.' },
      ],
      metadata: {},
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-13T00:01:00.000Z',
    })
    fetchDocumentVersions.mockResolvedValue([{
      id: 'version-1',
      documentId: 'doc-1',
      label: 'Initial version',
      title: 'Backend document',
      blocks: [{ id: 'para-1', type: 'paragraph', content: 'Loaded from API.' }],
      metadata: {},
      createdAt: '2026-05-13T00:02:00.000Z',
    }])
    fetchReviewItems.mockResolvedValue({ items: [makeReviewItem({ id: 'review-from-api', documentId: 'doc-1' })] })

    await useWorkspaceStore.getState().loadDocument('doc-1')

    const state = useWorkspaceStore.getState()
    expect(fetchDocument).toHaveBeenCalledWith('doc-1')
    expect(fetchDocumentVersions).toHaveBeenCalledWith('doc-1')
    expect(fetchReviewItems).toHaveBeenCalledWith('doc-1')
    expect(state.activeDocumentId).toBe('doc-1')
    expect(state.reviewItems[0].id).toBe('review-from-api')
    expect(state.documentBlocks[1].content).toBe('Loaded from API.')
    expect(state.documentVersions[0]).toEqual(expect.objectContaining({
      id: 'version-1',
      label: 'Initial version',
      isCurrent: true,
    }))
    expect(state.saveStatus).toBe('saved')
    expect(state.documentErrorMessage).toBe('')
  })

  it('saves edited blocks to the active backend document', async () => {
    useWorkspaceStore.setState({
      activeDocumentId: 'doc-1',
      documentBlocks: [{ id: 'para-1', type: 'paragraph', content: 'Edited content.' }],
    })
    updateDocument.mockResolvedValue({
      id: 'doc-1',
      title: 'Edited document',
      blocks: [{ id: 'para-1', type: 'paragraph', content: 'Edited content.' }],
      metadata: {},
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-13T00:05:00.000Z',
    })

    await useWorkspaceStore.getState().saveCurrentDocument()

    expect(updateDocument).toHaveBeenCalledWith('doc-1', {
      title: '研究工作台文档',
      blocks: [{ id: 'para-1', type: 'paragraph', content: 'Edited content.' }],
    })
    expect(useWorkspaceStore.getState().saveStatus).toBe('saved')
  })

  it('persists accepted suggestions through the backend when a document is active', async () => {
    const beforeBlock = useWorkspaceStore.getState().documentBlocks.find(block => block.type === 'paragraph')
    expect(beforeBlock).toBeDefined()
    updateDocument.mockResolvedValue({
      id: 'doc-1',
      title: 'Backend document',
      blocks: [{ ...beforeBlock!, content: 'Accepted backend content.' }],
      metadata: {},
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-13T00:05:00.000Z',
    })
    useWorkspaceStore.setState({ activeDocumentId: 'doc-1' })
    useWorkspaceStore.getState().setCurrentSuggestion({
      id: 'backend-suggestion',
      title: '后端保存建议',
      summary: '接受后应保存到后端。',
      targetBlockIds: [beforeBlock!.id],
      operation: 'replace_blocks',
      beforeBlocks: [{ ...beforeBlock! }],
      afterBlocks: [{ ...beforeBlock!, content: 'Accepted backend content.' }],
      reason: '测试后端保存路径。',
      confidence: 0.8,
      createdAt: '2026-05-13T00:00:00.000Z',
      changes: [{
        id: 'backend-change',
        blockId: beforeBlock!.id,
        type: 'modify',
        originalText: beforeBlock!.content,
        revisedText: 'Accepted backend content.',
        reason: '测试后端保存路径。',
      }],
      reasons: ['测试后端保存路径。'],
      reasoningSteps: ['接受建议后保存。'],
    })

    useWorkspaceStore.getState().acceptSuggestion()

    await vi.waitFor(() => {
      expect(updateDocument).toHaveBeenCalled()
    })
    expect(window.localStorage.getItem(WORKBENCH_SNAPSHOT_KEY)).toBeNull()
    expect(useWorkspaceStore.getState().saveStatus).toBe('saved')
  })

  it('creates backend versions and restores them through the document API', async () => {
    useWorkspaceStore.setState({
      activeDocumentId: 'doc-1',
      documentBlocks: [{ id: 'para-1', type: 'paragraph', content: 'Current content.' }],
      documentVersions: [],
    })
    createDocumentVersion.mockResolvedValue({
      id: 'version-1',
      documentId: 'doc-1',
      label: 'Reviewed draft',
      title: 'Backend document',
      blocks: [{ id: 'para-1', type: 'paragraph', content: 'Current content.' }],
      metadata: {},
      createdAt: '2026-05-13T00:03:00.000Z',
    })
    restoreDocumentVersion.mockResolvedValue({
      id: 'doc-1',
      title: 'Backend document',
      blocks: [{ id: 'para-1', type: 'paragraph', content: 'Restored content.' }],
      metadata: {},
      createdAt: '2026-05-13T00:00:00.000Z',
      updatedAt: '2026-05-13T00:06:00.000Z',
    })

    await useWorkspaceStore.getState().createCurrentDocumentVersion('Reviewed draft')
    expect(createDocumentVersion).toHaveBeenCalledWith('doc-1', 'Reviewed draft')
    expect(useWorkspaceStore.getState().documentVersions[0].id).toBe('version-1')

    await useWorkspaceStore.getState().restoreDocumentVersion('version-1')
    expect(restoreDocumentVersion).toHaveBeenCalledWith('doc-1', 'version-1')
    expect(useWorkspaceStore.getState().documentBlocks[0].content).toBe('Restored content.')
    expect(useWorkspaceStore.getState().activeVersionId).toBe('version-1')
  })

  it('records API errors and keeps an explicit local fallback status', async () => {
    fetchDocument.mockRejectedValue(new Error('backend unavailable'))

    await useWorkspaceStore.getState().loadDocument('doc-404')

    expect(useWorkspaceStore.getState().documentErrorMessage).toBe('backend unavailable')
    expect(useWorkspaceStore.getState().saveStatus).toBe('modified')
  })

  it('defensively clones review items when setting them', () => {
    const store = useWorkspaceStore.getState()
    const item = makeReviewItem({
      targetBlockIds: ['b1'],
      beforeBlocks: [{ id: 'b1', type: 'paragraph', content: 'Before content' }],
      afterBlocks: [{ id: 'b1', type: 'paragraph', content: 'After content' }],
      changes: [{
        id: 'change-1',
        blockId: 'b1',
        type: 'modify',
        originalText: 'Before content',
        revisedText: 'After content',
        reason: 'Improve clarity',
      }],
      evidenceIds: ['evidence-1'],
    })
    const items = [item]

    store.setReviewItems(items)
    item.targetBlockIds.push('b2')
    item.beforeBlocks[0].content = 'Mutated before content'
    item.changes[0].reason = 'Mutated reason'
    item.evidenceIds.push('evidence-2')

    expect(useWorkspaceStore.getState().reviewItems).toHaveLength(1)
    expect(useWorkspaceStore.getState().reviewItems).not.toBe(items)
    expect(useWorkspaceStore.getState().reviewItems[0].targetBlockIds).toEqual(['b1'])
    expect(useWorkspaceStore.getState().reviewItems[0].beforeBlocks[0].content).toBe('Before content')
    expect(useWorkspaceStore.getState().reviewItems[0].changes[0].reason).toBe('Improve clarity')
    expect(useWorkspaceStore.getState().reviewItems[0].evidenceIds).toEqual(['evidence-1'])
  })

  it('prepends a new review item when upserting', () => {
    const store = useWorkspaceStore.getState()
    store.setReviewItems([makeReviewItem({ id: 'review-existing' })])
    store.upsertReviewItem(makeReviewItem({ id: 'review-new' }))

    expect(useWorkspaceStore.getState().reviewItems.map(item => item.id)).toEqual([
      'review-new',
      'review-existing',
    ])
  })

  it('defensively clones new review items when upserting', () => {
    const store = useWorkspaceStore.getState()
    const item = makeReviewItem({
      id: 'review-new',
      targetBlockIds: ['b1'],
      beforeBlocks: [{ id: 'b1', type: 'paragraph', content: 'Before content' }],
    })

    store.upsertReviewItem(item)
    item.targetBlockIds.push('b2')
    item.beforeBlocks[0].content = 'Mutated before content'

    expect(useWorkspaceStore.getState().reviewItems[0].targetBlockIds).toEqual(['b1'])
    expect(useWorkspaceStore.getState().reviewItems[0].beforeBlocks[0].content).toBe('Before content')
  })

  it('replaces an existing review item in place when upserting', () => {
    const store = useWorkspaceStore.getState()
    store.setReviewItems([
      makeReviewItem({ id: 'review-1', status: 'pending' }),
      makeReviewItem({ id: 'review-2', status: 'pending' }),
    ])

    store.upsertReviewItem(makeReviewItem({ id: 'review-2', status: 'deferred' }))

    expect(useWorkspaceStore.getState().reviewItems.map(item => [item.id, item.status])).toEqual([
      ['review-1', 'pending'],
      ['review-2', 'deferred'],
    ])
  })

  it('defensively clones replacement review items when upserting', () => {
    const store = useWorkspaceStore.getState()
    const replacement = makeReviewItem({
      id: 'review-2',
      targetBlockIds: ['b2'],
      beforeBlocks: [{ id: 'b2', type: 'paragraph', content: 'Replacement content' }],
    })
    store.setReviewItems([
      makeReviewItem({ id: 'review-1' }),
      makeReviewItem({ id: 'review-2' }),
    ])

    store.upsertReviewItem(replacement)
    replacement.targetBlockIds.push('b3')
    replacement.beforeBlocks[0].content = 'Mutated replacement content'

    expect(useWorkspaceStore.getState().reviewItems.map(item => item.id)).toEqual(['review-1', 'review-2'])
    expect(useWorkspaceStore.getState().reviewItems[1].targetBlockIds).toEqual(['b2'])
    expect(useWorkspaceStore.getState().reviewItems[1].beforeBlocks[0].content).toBe('Replacement content')
  })

  it('updates review item status timestamp and accepted version', () => {
    const now = new Date('2026-05-15T12:34:56.000Z')
    const store = useWorkspaceStore.getState()
    vi.useFakeTimers()

    try {
      vi.setSystemTime(now)
      store.setReviewItems([makeReviewItem()])
      store.setReviewItemStatus('review-1', 'accepted', 'version-after-1')

      const updatedItem = useWorkspaceStore.getState().reviewItems[0]
      expect(updatedItem.status).toBe('accepted')
      expect(updatedItem.versionAfterId).toBe('version-after-1')
      expect(updatedItem.updatedAt).toBe(now.toISOString())
      expect(updateReviewItem).toHaveBeenCalledWith('review-1', {
        documentId: 'doc-1',
        status: 'accepted',
        versionAfterId: 'version-after-1',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('clears review item accepted version when status update receives null', () => {
    const store = useWorkspaceStore.getState()
    store.setReviewItems([makeReviewItem({ versionAfterId: 'version-after-1' })])

    store.setReviewItemStatus('review-1', 'deferred', null)

    expect(useWorkspaceStore.getState().reviewItems[0].versionAfterId).toBeNull()
  })

  it('clears review items when resetting the workspace', () => {
    const store = useWorkspaceStore.getState()
    store.setReviewItems([makeReviewItem()])
    expect(useWorkspaceStore.getState().reviewItems).toHaveLength(1)

    store.resetWorkspace()

    expect(useWorkspaceStore.getState().reviewItems).toEqual([])
  })

  it('converts current suggestion into a pending review item', () => {
    const store = useWorkspaceStore.getState()
    store.startDocumentToolRun('expand', 'block-intro-1')
    store.setCurrentSuggestion({
      id: 'suggestion-1',
      title: 'AI 生成的修改建议',
      summary: 'Improve clarity',
      targetBlockIds: ['b1'],
      operation: 'replace_blocks',
      beforeBlocks: [],
      afterBlocks: [],
      reason: 'Improve clarity',
      confidence: 0.8,
      changes: [],
      reasons: ['Improve clarity'],
      reasoningSteps: ['Generated from selected paragraph'],
      createdAt: '2026-05-15T00:00:00Z',
    })

    store.enqueueCurrentSuggestionAsReviewItem('doc-1')

    expect(useWorkspaceStore.getState().reviewItems[0]).toMatchObject({
      documentId: 'doc-1',
      source: 'document_tool',
      kind: 'rewrite',
      status: 'pending',
      reason: 'Improve clarity',
    })
  })

  it('routes finished AI generation into the review queue', () => {
    const store = useWorkspaceStore.getState()
    const targetBlock = store.startAIRun('block-intro-1')
    expect(targetBlock?.id).toBe('block-intro-1')

    store.appendGeneratedToken('Generated paragraph for review.')
    store.finishAIRunAsSuggestion()

    const state = useWorkspaceStore.getState()
    expect(state.currentSuggestion?.changes[0].revisedText).toBe('Generated paragraph for review.')
    expect(state.reviewItems[0]).toMatchObject({
      documentId: 'local-draft',
      source: 'document_tool',
      kind: 'rewrite',
      status: 'pending',
      reason: state.currentSuggestion?.reason,
    })
    expect(state.rightPanelMode).toBe('review')
  })

  it('persists finished AI generation review items for backend documents', () => {
    useWorkspaceStore.setState({ activeDocumentId: 'doc-1' })
    const store = useWorkspaceStore.getState()
    const targetBlock = store.startAIRun('block-intro-1')
    expect(targetBlock?.id).toBe('block-intro-1')

    store.appendGeneratedToken('Generated paragraph for backend review.')
    store.finishAIRunAsSuggestion()

    expect(createReviewItem).toHaveBeenCalledWith(expect.objectContaining({
      documentId: 'doc-1',
      source: 'document_tool',
      kind: 'rewrite',
      status: 'pending',
      versionAfterId: null,
    }))
  })

  it('replaces an existing suggestion review item with the same id', () => {
    const store = useWorkspaceStore.getState()
    store.setCurrentSuggestion({
      id: 'suggestion-duplicate',
      title: 'AI 生成的修改建议',
      summary: 'First summary',
      targetBlockIds: ['b1'],
      operation: 'replace_blocks',
      beforeBlocks: [],
      afterBlocks: [],
      reason: 'First reason',
      confidence: 0.8,
      changes: [],
      reasons: ['First reason'],
      reasoningSteps: ['Generated from selected paragraph'],
      createdAt: '2026-05-15T00:00:00Z',
    })

    store.enqueueCurrentSuggestionAsReviewItem('doc-1')
    store.setCurrentSuggestion({
      id: 'suggestion-duplicate',
      title: 'AI 生成的修改建议',
      summary: 'Updated summary',
      targetBlockIds: ['b2'],
      operation: 'replace_blocks',
      beforeBlocks: [],
      afterBlocks: [],
      reason: 'Updated reason',
      confidence: 0.8,
      changes: [],
      reasons: ['Updated reason'],
      reasoningSteps: ['Generated from selected paragraph'],
      createdAt: '2026-05-15T00:00:00Z',
    })
    store.enqueueCurrentSuggestionAsReviewItem('doc-1')

    expect(useWorkspaceStore.getState().reviewItems).toHaveLength(1)
    expect(useWorkspaceStore.getState().reviewItems[0]).toMatchObject({
      id: 'review-suggestion-duplicate',
      reason: 'Updated reason',
      targetBlockIds: ['b2'],
    })
  })

  it('preserves AI run mode kind and metadata when generation finishes', () => {
    const store = useWorkspaceStore.getState()
    const activeVersionId = useWorkspaceStore.getState().activeVersionId
    const targetBlock = store.startDocumentToolRun('expand', 'block-intro-1')
    expect(targetBlock?.id).toBe('block-intro-1')

    store.appendGeneratedToken('Expanded paragraph for review.')
    store.finishAIRunAsSuggestion()

    const state = useWorkspaceStore.getState()
    const reviewItem = state.reviewItems[0]
    expect(reviewItem).toMatchObject({
      documentId: 'local-draft',
      kind: 'expand',
      versionBeforeId: activeVersionId,
      versionAfterId: null,
      createdAt: state.currentSuggestion?.createdAt,
      updatedAt: state.currentSuggestion?.createdAt,
    })
    expect(reviewItem.beforeBlocks[0].id).toBe('block-intro-1')
    expect(reviewItem.afterBlocks[0].content).toBe('Expanded paragraph for review.')
    expect(reviewItem.changes[0].revisedText).toBe('Expanded paragraph for review.')
  })
})
