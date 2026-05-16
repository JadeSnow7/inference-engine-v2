import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MouseEvent, ReactNode } from 'react'

const connectSSE = vi.hoisted(() => vi.fn())
const analyzeWriting = vi.hoisted(() => vi.fn())
const listDocuments = vi.hoisted(() => vi.fn())
const createDocument = vi.hoisted(() => vi.fn())
const fetchDocument = vi.hoisted(() => vi.fn())
const updateDocument = vi.hoisted(() => vi.fn())
const fetchDocumentVersions = vi.hoisted(() => vi.fn())
const createDocumentVersion = vi.hoisted(() => vi.fn())
const restoreDocumentVersion = vi.hoisted(() => vi.fn())

vi.mock('../../../api/sse', () => ({
  connectSSE: (...args: unknown[]) => connectSSE(...args),
}))

vi.mock('../../../api/writing', () => ({
  analyzeWriting: (...args: unknown[]) => analyzeWriting(...args),
}))

vi.mock('../../../api/documents', () => ({
  listDocuments: (...args: unknown[]) => listDocuments(...args),
  createDocument: (...args: unknown[]) => createDocument(...args),
  fetchDocument: (...args: unknown[]) => fetchDocument(...args),
  updateDocument: (...args: unknown[]) => updateDocument(...args),
  fetchDocumentVersions: (...args: unknown[]) => fetchDocumentVersions(...args),
  createDocumentVersion: (...args: unknown[]) => createDocumentVersion(...args),
  restoreDocumentVersion: (...args: unknown[]) => restoreDocumentVersion(...args),
}))

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({
    nodes,
    onNodeClick,
    children,
  }: {
    nodes: Array<{ id: string; data: { label: string } }>
    onNodeClick?: (event: MouseEvent, node: { id: string; data: { label: string } }) => void
    children?: ReactNode
  }) => (
    <div data-testid="knowledge-flow">
      {nodes.map(node => (
        <button key={node.id} type="button" onClick={(event) => onNodeClick?.(event, node)}>
          {node.data.label}
        </button>
      ))}
      {children}
    </div>
  ),
  Background: () => <div data-testid="flow-background" />,
  Controls: () => <div data-testid="flow-controls" />,
}))

import WorkspacePage from '../WorkspacePage'
import { useWorkspaceStore } from '../../../store/workspace'
import { VersionList } from '../../../features/version/VersionList'
import { aiSuggestion } from '../../../mocks/workspaceMock'
import type { DocumentBlock, DocumentVersionSnapshot } from '../../../types/workspace'

function installMemoryStorage() {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
}

function block(id: string, content: string, title?: string): DocumentBlock {
  return {
    id,
    type: 'paragraph',
    title,
    content,
  }
}

function setVersionPreviewFixture(currentBlocks: DocumentBlock[], snapshotBlocks: DocumentBlock[]) {
  const currentVersion: DocumentVersionSnapshot = {
    id: 'current-version',
    label: 'v4.0（当前）',
    summary: '当前正文',
    updatedAt: '刚刚',
    isCurrent: true,
    createdAt: '2026-05-01T00:00:00.000Z',
    documentBlocks: currentBlocks,
  }
  const snapshotVersion: DocumentVersionSnapshot = {
    id: 'history-version',
    label: 'v3.9',
    summary: '历史快照',
    updatedAt: '昨天',
    isCurrent: false,
    createdAt: '2026-04-30T00:00:00.000Z',
    documentBlocks: snapshotBlocks,
  }

  useWorkspaceStore.setState({
    activeVersionId: currentVersion.id,
    documentBlocks: currentBlocks,
    documentVersions: [currentVersion, snapshotVersion],
    previewVersionId: null,
    isRestoringVersion: false,
    currentSuggestion: null,
    saveStatus: 'saved',
  })
}

describe('WorkspacePage', () => {
  beforeEach(() => {
    installMemoryStorage()
    connectSSE.mockReset()
    analyzeWriting.mockReset()
    listDocuments.mockReset()
    createDocument.mockReset()
    fetchDocument.mockReset()
    updateDocument.mockReset()
    fetchDocumentVersions.mockReset()
    createDocumentVersion.mockReset()
    restoreDocumentVersion.mockReset()
    listDocuments.mockImplementation(() => new Promise(() => {}))
    analyzeWriting.mockResolvedValue({
      nodes: [],
      expanded_context: [],
      validation: [],
      references: [],
    })
    window.localStorage.removeItem('workbench:documentBlocks:v1')
    window.localStorage.removeItem('workbench:workspaceSnapshot:v1')
    useWorkspaceStore.getState().resetWorkspace()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the three-column academic writing workspace', () => {
    render(<WorkspacePage />)

    expect(screen.getByText('学术写作助手')).toBeInTheDocument()
    expect(screen.getByText('对话历史')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '基于深度学习的图像分类方法综述' })).toBeInTheDocument()
    expect(screen.getAllByText('知识图谱').length).toBeGreaterThan(0)
    expect(screen.getByTestId('knowledge-flow')).toBeInTheDocument()
  })

  it('updates node detail after graph node click', async () => {
    render(<WorkspacePage />)

    fireEvent.click(screen.getByRole('button', { name: 'Transformer' }))

    expect(screen.getByRole('heading', { name: 'Transformer' })).toBeInTheDocument()
    expect(screen.getByText(/自注意力机制建模长距离依赖/)).toBeInTheDocument()
  })

  it('links document citation clicks to the related knowledge graph node', async () => {
    render(<WorkspacePage />)

    fireEvent.click(screen.getByRole('button', { name: 'Transformer' }))
    expect(screen.getByRole('heading', { name: 'Transformer' })).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: '[1]' })[0])

    expect(useWorkspaceStore.getState().selectedReferenceId).toBe('ref-alexnet')
    expect(useWorkspaceStore.getState().selectedGraphNodeId).toBe('cnn')
    expect(useWorkspaceStore.getState().selectedBlockId).toBe('block-intro-1')
    expect(screen.getByRole('heading', { name: '卷积神经网络（CNN）' })).toBeInTheDocument()
  })

  it('selects a missing-citation paragraph before explicit citation enhancement', async () => {
    connectSSE.mockImplementation((message, handlers) => {
      expect(message).toContain('引用增强')
      expect(message).toContain('本文旨在综述近年来基于深度学习的图像分类方法')
      handlers.onToken('经过引用增强后的段落内容。')
      handlers.onDone()
      return { abort: vi.fn() }
    })

    render(<WorkspacePage />)

    fireEvent.click(screen.getByRole('button', { name: /本文旨在综述近年来基于深度学习的图像分类方法/ }))

    expect(connectSSE).not.toHaveBeenCalled()
    expect(useWorkspaceStore.getState().selectedBlockId).toBe('block-intro-2')

    fireEvent.click(screen.getByRole('button', { name: '风险引用增强 block-intro-2' }))

    expect(connectSSE).toHaveBeenCalledTimes(1)
    // 引用增强建议应被生成
    expect(useWorkspaceStore.getState().currentSuggestion?.title).toBe('引用增强建议')
    expect(useWorkspaceStore.getState().currentSuggestion?.targetBlockIds).toEqual(['block-intro-2'])
    expect(screen.getByText('引用增强建议')).toBeInTheDocument()
    expect(screen.getByText('引用增强完成')).toBeInTheDocument()
  })

  it('shows citation risk levels as missing unmatched and matched without claiming verification', () => {
    const blocks = useWorkspaceStore.getState().documentBlocks.map(block => (
      block.id === 'block-related-work'
        ? {
            ...block,
            citations: [{ id: 'cite-missing-reference', label: '[99]', referenceId: 'ref-not-in-library' }],
          }
        : block
    ))

    useWorkspaceStore.setState({ documentBlocks: blocks })

    render(<WorkspacePage />)

    expect(screen.getByText('缺少引用 1')).toBeInTheDocument()
    expect(screen.getByText('待核验引用 1')).toBeInTheDocument()
    expect(screen.getByText('已匹配文献 3')).toBeInTheDocument()
    expect(screen.getByText('本轮检索文献 0')).toBeInTheDocument()
    expect(screen.queryByText(/已验证/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /传统的图像分类方法主要基于手工设计的特征提取器/ }))

    expect(useWorkspaceStore.getState().selectedBlockId).toBe('block-related-work')
    expect(connectSSE).not.toHaveBeenCalled()
  })

  it('runs citation enhancement from a paragraph action through SSE as a reviewable suggestion', async () => {
    analyzeWriting.mockResolvedValueOnce({
      nodes: [],
      expanded_context: [],
      validation: [],
      references: [{ id: 'ref-writing-citation', title: 'Writing Citation Norm', source: 'Norm Corpus', score: 0.88 }],
    })
    connectSSE.mockImplementation((message, handlers) => {
      expect(message).toContain('引用增强')
      expect(message).toContain('本文旨在综述近年来基于深度学习的图像分类方法')
      handlers.onStage('文献检索中')
      handlers.onPapers([{ id: 'paper-citation-1', title: 'Citation Candidate', year: 2025, score: 0.91 }])
      handlers.onToken('本文旨在综述近年来基于深度学习的图像分类方法，并结合最新研究补充其结构演进与训练策略依据。')
      handlers.onDone()
      return { abort: vi.fn() }
    })

    render(<WorkspacePage />)

    fireEvent.click(screen.getByRole('button', { name: '引用增强 block-intro-2' }))

    expect(analyzeWriting).toHaveBeenCalledWith({
      text: expect.stringContaining('本文旨在综述近年来基于深度学习的图像分类方法'),
      mode: 'citation',
      session_id: undefined,
    })
    expect(connectSSE).toHaveBeenCalledTimes(1)
    expect(useWorkspaceStore.getState().selectedBlockId).toBe('block-intro-2')
    expect(useWorkspaceStore.getState().currentSuggestion?.targetBlockIds).toEqual(['block-intro-2'])
    expect(useWorkspaceStore.getState().currentSuggestion?.title).toBe('引用增强建议')
    expect(screen.getByText('引用增强完成')).toBeInTheDocument()
    expect(screen.getAllByText(/结合最新研究补充其结构演进/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Citation Candidate' })).toBeInTheDocument()
    await waitFor(() => {
      expect(useWorkspaceStore.getState().references.some(reference => reference.id === 'ref-writing-citation')).toBe(true)
    })
  })

  it.each([
    ['改写 block-intro-2', '改写', '改写建议', '改写后的段落内容。'],
    ['扩写 block-intro-2', '扩写', '扩写建议', '扩写后的段落内容，补充了更多背景和论据。'],
    ['逻辑检查 block-intro-2', '逻辑检查', '逻辑检查建议', '逻辑检查后的段落内容，修正了论证顺序。'],
  ])('runs the %s document tool through SSE', async (buttonName, promptKeyword, suggestionTitle, generatedText) => {
    connectSSE.mockImplementation((message, handlers) => {
      expect(message).toContain(promptKeyword)
      expect(message).toContain('本文旨在综述近年来基于深度学习的图像分类方法')
      handlers.onToken(generatedText)
      handlers.onDone()
      return { abort: vi.fn() }
    })

    render(<WorkspacePage />)

    fireEvent.click(screen.getByRole('button', { name: buttonName }))

    expect(connectSSE).toHaveBeenCalledTimes(1)
    expect(useWorkspaceStore.getState().selectedBlockId).toBe('block-intro-2')
    expect(useWorkspaceStore.getState().currentSuggestion?.title).toBe(suggestionTitle)
    expect(screen.getByText(suggestionTitle)).toBeInTheDocument()
    expect(screen.getAllByText(generatedText).length).toBeGreaterThan(0)
  })

  it('selects the first cited document block when a graph node is clicked', async () => {
    render(<WorkspacePage />)

    act(() => {
      useWorkspaceStore.getState().setSelectedBlock('block-intro-1')
    })

    fireEvent.click(screen.getByRole('button', { name: '迁移学习' }))

    expect(useWorkspaceStore.getState().selectedGraphNodeId).toBe('transfer-learning')
    expect(useWorkspaceStore.getState().selectedBlockId).toBe('block-related-work')
    expect(screen.getByRole('heading', { name: '迁移学习' })).toBeInTheDocument()
  })

  it('selects the first explicit related block when a graph node has blockIds', async () => {
    useWorkspaceStore.setState({
      graphNodes: [
        {
          id: 'paper:explicit-related',
          label: 'Explicit Related Paper',
          type: 'paper',
          description: '测试显式段落关联。',
          referenceIds: [],
          blockIds: ['block-intro-2'],
          position: { x: 0, y: 0 },
        },
      ],
      graphEdges: [],
      references: [],
      selectedGraphNodeId: 'paper:explicit-related',
    })

    render(<WorkspacePage />)

    fireEvent.click(screen.getByRole('button', { name: 'Explicit Related Paper' }))

    expect(useWorkspaceStore.getState().selectedGraphNodeId).toBe('paper:explicit-related')
    expect(useWorkspaceStore.getState().selectedBlockId).toBe('block-intro-2')
  })

  it('shows related document paragraphs in node detail and locates them without SSE', async () => {
    render(<WorkspacePage />)

    expect(screen.getByText('关联正文段落')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '定位正文段落 block-cnn' }))

    expect(useWorkspaceStore.getState().selectedBlockId).toBe('block-cnn')
    expect(useWorkspaceStore.getState().selectedGraphNodeId).toBe('cnn')
    expect(connectSSE).not.toHaveBeenCalled()
  })

  it('shows an empty related paragraph state when the selected node has no document links', async () => {
    render(<WorkspacePage />)

    fireEvent.click(screen.getByRole('button', { name: '数据增强' }))

    expect(screen.getByText('暂无关联正文段落')).toBeInTheDocument()
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
  })

  it('generates a suggestion from SSE output and accepts it into the document', async () => {
    connectSSE.mockImplementation((_message, handlers) => {
      handlers.onSessionId?.('sess-workbench')
      handlers.onStage('文献检索中')
      handlers.onToken('真实 SSE 改写后的段落内容。')
      handlers.onDone()
      return { abort: vi.fn() }
    })

    render(<WorkspacePage />)

    expect(screen.getByText('暂无待处理修改建议')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/输入您的问题或需求/), {
      target: { value: '请增强传统方法段落' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(connectSSE).toHaveBeenCalledTimes(1)
    expect(screen.getByText('生成完成')).toBeInTheDocument()
    expect(screen.getAllByText('真实 SSE 改写后的段落内容。').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: '接受全部' }))

    expect(screen.getByText('已保存到本地')).toBeInTheDocument()
    expect(screen.getByText('真实 SSE 改写后的段落内容。')).toBeInTheDocument()
    expect(screen.getByText('暂无待处理修改建议')).toBeInTheDocument()
    expect(screen.getByText('已根据真实 AI 输出生成一条可审阅的文档修改建议。')).toBeInTheDocument()
  })

  it('keeps web search mode disabled until a real provider is configured', async () => {
    connectSSE.mockImplementation((message, handlers) => {
      expect(message).not.toContain('联网搜索意图')
      handlers.onToken('普通深度思考输出。')
      handlers.onDone()
      return { abort: vi.fn() }
    })

    render(<WorkspacePage />)

    const webSearchButton = screen.getByRole('button', { name: '联网搜索' })
    expect(webSearchButton).toBeDisabled()
    expect(webSearchButton).toHaveAttribute('title', '后端未配置实时公网搜索，暂不可用')

    fireEvent.click(webSearchButton)
    fireEvent.change(screen.getByPlaceholderText(/输入您的问题或需求/), {
      target: { value: '请检查是否需要外部事实' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(connectSSE).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('普通深度思考输出。').length).toBeGreaterThan(0)
  })

  it('does not start a second SSE request while generation is running', async () => {
    connectSSE.mockImplementation((_message, handlers) => {
      handlers.onStage('文献检索中')
      return { abort: vi.fn() }
    })

    render(<WorkspacePage />)

    fireEvent.change(screen.getByPlaceholderText(/输入您的问题或需求/), {
      target: { value: '请增强传统方法段落' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    fireEvent.keyDown(screen.getByPlaceholderText(/输入您的问题或需求/), {
      key: 'Enter',
      code: 'Enter',
    })

    expect(connectSSE).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: '停止生成' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '引用增强' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '风险引用增强 block-intro-2' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '引用增强 block-intro-2' })).toBeDisabled()
  })

  it('accepts only the current diff change and keeps the remaining suggestion open', async () => {
    useWorkspaceStore.getState().setCurrentSuggestion(aiSuggestion)

    render(<WorkspacePage />)

    fireEvent.click(screen.getByRole('button', { name: '2. 新增' }))
    fireEvent.click(screen.getByRole('button', { name: '接受当前' }))

    expect(screen.getAllByText(/网络结构演进、训练数据规模/).length).toBeGreaterThan(0)
    expect(screen.getByText(/传统的图像分类方法主要基于手工设计的特征提取器/)).toBeInTheDocument()
    expect(screen.getByText('2/2 处修改')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '接受全部' })).toBeInTheDocument()
  })

  it('previews an older version before confirmed restore', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    connectSSE.mockImplementation((_message, handlers) => {
      handlers.onToken('真实 SSE 改写后的段落内容。')
      handlers.onDone()
      return { abort: vi.fn() }
    })

    render(<WorkspacePage />)

    fireEvent.change(screen.getByPlaceholderText(/输入您的问题或需求/), {
      target: { value: '请增强传统方法段落' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    fireEvent.click(screen.getByRole('button', { name: '接受全部' }))

    fireEvent.click(screen.getByRole('button', { name: /v3\.2/ }))

    expect(screen.getByText('正在预览历史版本')).toBeInTheDocument()
    expect(screen.getByText(/预览不会修改当前正文/)).toBeInTheDocument()
    expect(screen.getByText('真实 SSE 改写后的段落内容。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '取消预览' }))

    expect(screen.queryByText('正在预览历史版本')).not.toBeInTheDocument()
    expect(screen.getByText('真实 SSE 改写后的段落内容。')).toBeInTheDocument()

    act(() => {
      useWorkspaceStore.getState().setSaveStatus('modified')
    })
    fireEvent.click(screen.getByRole('button', { name: /v3\.2/ }))
    confirm.mockReturnValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: '恢复此版本' }))

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('当前存在待处理 AI 修改建议或未保存修改'))
    expect(screen.getByText('真实 SSE 改写后的段落内容。')).toBeInTheDocument()

    confirm.mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: '恢复此版本' }))

    expect(screen.queryByText('真实 SSE 改写后的段落内容。')).not.toBeInTheDocument()
    expect(screen.getByText(/图像分类是计算机视觉领域的核心任务之一/)).toBeInTheDocument()
    expect(screen.queryByText('正在预览历史版本')).not.toBeInTheDocument()
  })

  it('renders an empty state when no version snapshots are available', () => {
    useWorkspaceStore.setState({ documentVersions: [], activeVersionId: null })

    render(<VersionList />)

    expect(screen.getByText('暂无版本记录')).toBeInTheDocument()
  })

  it('shows block-level diff summary when previewing an older version', () => {
    setVersionPreviewFixture(
      [
        block('unchanged-block', '两边都相同的段落。'),
        block('modified-block', '当前版本改写后的段落。', '当前标题'),
        block('current-only-block', '当前版本新增的段落。'),
      ],
      [
        block('unchanged-block', '两边都相同的段落。'),
        block('modified-block', '历史版本中的旧段落。', '历史标题'),
        block('snapshot-only-block', '历史版本中仍存在的段落。'),
      ],
    )

    render(<VersionList />)

    fireEvent.click(screen.getByRole('button', { name: /v3\.9/ }))

    expect(screen.getByText('版本差异预览')).toBeInTheDocument()
    expect(screen.getByText('内容变化')).toBeInTheDocument()
    expect(screen.getByText(/历史版本中的旧段落/)).toBeInTheDocument()
    expect(screen.getByText('历史存在')).toBeInTheDocument()
    expect(screen.getAllByText(/历史版本中仍存在的段落/).length).toBeGreaterThan(0)
    expect(screen.getByText('当前新增')).toBeInTheDocument()
    expect(screen.getAllByText(/当前版本新增的段落/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/两边都相同的段落/)).not.toBeInTheDocument()
  })

  it('limits version preview diff summary to five changes with a remaining count', () => {
    const currentBlocks = Array.from({ length: 7 }, (_, index) => (
      block(`changed-block-${index}`, `当前段落 ${index}`)
    ))
    const snapshotBlocks = Array.from({ length: 7 }, (_, index) => (
      block(`changed-block-${index}`, `历史段落 ${index}`)
    ))
    setVersionPreviewFixture(currentBlocks, snapshotBlocks)

    render(<VersionList />)

    fireEvent.click(screen.getByRole('button', { name: /v3\.9/ }))

    expect(screen.getAllByText('内容变化')).toHaveLength(5)
    expect(screen.getByText('还有 2 处变化')).toBeInTheDocument()
    expect(screen.queryByText(/历史段落 5/)).not.toBeInTheDocument()
  })

  it('renders review principle and knowledge graph empty states', () => {
    useWorkspaceStore.setState({
      currentSuggestion: null,
      graphNodes: [],
      graphEdges: [],
      selectedGraphNodeId: null,
    })

    render(<WorkspacePage />)

    expect(screen.getByText('暂无待处理修改建议')).toBeInTheDocument()
    expect(screen.getByText('AI 修改必须经过审查后才会写入正文。')).toBeInTheDocument()
    expect(screen.getByText('暂无图谱节点')).toBeInTheDocument()
    expect(screen.getByText('暂无节点详情')).toBeInTheDocument()
  })

  it('shows restoring state in version preview actions', () => {
    useWorkspaceStore.setState({
      previewVersionId: 'v3-1',
      isRestoringVersion: true,
    })

    render(<VersionList />)

    expect(screen.getByRole('button', { name: '恢复中' })).toBeDisabled()
  })

  it('renders SSE papers and gaps as dynamic knowledge graph nodes', async () => {
    connectSSE.mockImplementation((_message, handlers) => {
      handlers.onStage('文献检索中')
      handlers.onPapers([{ id: 'paper-live-1', title: 'Live Paper', year: 2025, score: 0.93 }])
      handlers.onGaps([{ id: 'gap-live-1', description: 'Live Gap', severity: 'high', addressed_by: 0, score: 0.87 }])
      handlers.onToken('真实 SSE 改写后的段落内容。')
      handlers.onDone()
      return { abort: vi.fn() }
    })

    render(<WorkspacePage />)

    fireEvent.change(screen.getByPlaceholderText(/输入您的问题或需求/), {
      target: { value: '请增强传统方法段落' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(screen.getByRole('button', { name: 'Live Paper' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Live Gap' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Live Paper' }))

    expect(screen.getAllByRole('heading', { name: 'Live Paper' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/2025/).length).toBeGreaterThan(0)
    expect(screen.getByText('本轮 SSE 检索结果')).toBeInTheDocument()
    expect(screen.getAllByText(/相关度 93%/).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Live Gap' }))

    expect(screen.getAllByRole('heading', { name: 'Live Gap' }).length).toBeGreaterThan(0)
    expect(screen.getByText('高风险空白')).toBeInTheDocument()
    expect(screen.getByText('暂无文献填补')).toBeInTheDocument()
    expect(screen.getAllByText(/相关度 87%/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
  })

  it('renders dynamic node details with fallbacks when retrieval fields are incomplete', () => {
    useWorkspaceStore.setState({
      selectedGraphNodeId: 'paper:paper-missing-fields',
      ragPapers: [{ id: 'paper-missing-fields' }],
      ragGaps: [{ id: 'gap-missing-fields' }],
      references: [{ id: 'paper-missing-fields', title: 'Untitled retrieval paper' }],
      graphNodes: [
        {
          id: 'paper:paper-missing-fields',
          label: 'Untitled retrieval paper',
          type: 'paper',
          description: 'SSE 检索返回的文献字段不完整。',
          referenceIds: ['paper-missing-fields'],
          position: { x: 0, y: 0 },
        },
        {
          id: 'gap:gap-missing-fields',
          label: '字段不完整的研究空白',
          type: 'gap',
          description: 'SSE 检索返回的研究空白字段不完整。',
          referenceIds: [],
          position: { x: 0, y: 80 },
        },
      ],
    })

    render(<WorkspacePage />)

    expect(screen.getByText('年份未知')).toBeInTheDocument()
    expect(screen.getByText('相关度待补充')).toBeInTheDocument()
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '字段不完整的研究空白' }))

    expect(screen.getByText('暂无风险等级')).toBeInTheDocument()
    expect(screen.getByText('暂无填补文献统计')).toBeInTheDocument()
    expect(screen.getByText('相关度待补充')).toBeInTheDocument()
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument()
  })

  it('shows an error without creating a mock suggestion when SSE fails', async () => {
    connectSSE.mockImplementation((_message, handlers) => {
      handlers.onStage('连接中')
      handlers.onError('连接中断，请重试')
      return { abort: vi.fn() }
    })

    render(<WorkspacePage />)

    fireEvent.change(screen.getByPlaceholderText(/输入您的问题或需求/), {
      target: { value: '请增强传统方法段落' },
    })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(screen.getByText('AI 生成失败')).toBeInTheDocument()
    expect(screen.getByText(/连接中断，请重试/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '接受全部' })).not.toBeInTheDocument()
    expect(screen.queryByText(/我已经分析了您的文档/)).not.toBeInTheDocument()
    expect(useWorkspaceStore.getState().currentSuggestion).toBeNull()
    expect(screen.getByText('暂无待处理修改建议')).toBeInTheDocument()
  })

  // ─── P2-2: 版本恢复审计提示 UI ────────────────────────────────────────────

  it('P2-2: shows restore success notice with version title, block count and time after confirm restore', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    // Set up: current version A, non-current version B with different content
    setVersionPreviewFixture(
      [block('block-a', '当前正文内容A'), block('block-b', '当前正文内容B')],
      [block('block-a', '历史正文内容A (modified)'), block('block-b', '历史正文内容B (modified)')],
    )

    render(<VersionList />)

    // Click the non-current version (v3.9) to start preview
    fireEvent.click(screen.getByRole('button', { name: /v3\.9/ }))

    expect(screen.getByText('正在预览历史版本')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '恢复此版本' }))

    // The notice banner should now be visible
    const notice = screen.getByRole('status')
    expect(notice).toBeInTheDocument()
    expect(screen.getByText(/恢复成功/)).toBeInTheDocument()
    // Version title (label 'v3.9') should appear in the notice
    expect(notice.textContent).toContain('v3.9')
    // Should show affected paragraph count (2 changed blocks)
    expect(notice.textContent).toMatch(/\d+\s*个段落/)
    // Should show restore time label
    expect(notice.textContent).toMatch(/恢复时间/)
  })

  it('P2-2: restore notice disappears when user clicks the close button', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    setVersionPreviewFixture(
      [block('block-x', '当前正文内容X')],
      [block('block-x', '历史正文内容X (modified)')],
    )

    render(<VersionList />)

    fireEvent.click(screen.getByRole('button', { name: /v3\.9/ }))
    fireEvent.click(screen.getByRole('button', { name: '恢复此版本' }))

    expect(screen.getByRole('status')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '关闭恢复提示' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
