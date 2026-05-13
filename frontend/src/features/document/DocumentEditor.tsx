import { useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { useWorkspaceStore, type DocumentToolMode, type InlineMarkdownSelection } from '../../store/workspace'
import type { CitationRiskLevel, DocumentBlock } from '../../types/workspace'
import { CitationHighlight } from './CitationHighlight'
import { DocumentOutlineCard } from './DocumentOutlineCard'
import { DocumentToolbar } from './DocumentToolbar'

const actionItems = [
  { label: '改写', kind: 'document_rewrite' },
  { label: '扩写', kind: 'expand' },
  { label: '引用增强', kind: 'citation' },
  { label: '逻辑检查', kind: 'logic_check' },
] as const

export function DocumentEditor() {
  const documentBlocks = useWorkspaceStore(state => state.documentBlocks)
  const selectedBlockId = useWorkspaceStore(state => state.selectedBlockId)
  const selectedGraphNodeId = useWorkspaceStore(state => state.selectedGraphNodeId)
  const selectedReferenceId = useWorkspaceStore(state => state.selectedReferenceId)
  const graphNodes = useWorkspaceStore(state => state.graphNodes)
  const references = useWorkspaceStore(state => state.references)
  const ragPapers = useWorkspaceStore(state => state.ragPapers)
  const aiRunStatus = useWorkspaceStore(state => state.aiRunStatus)
  const citationEnhancementRequest = useWorkspaceStore(state => state.citationEnhancementRequest)
  const saveStatus = useWorkspaceStore(state => state.saveStatus)
  const setSelectedBlock = useWorkspaceStore(state => state.setSelectedBlock)
  const selectCitationReference = useWorkspaceStore(state => state.selectCitationReference)
  const requestCitationEnhancement = useWorkspaceStore(state => state.requestCitationEnhancement)
  const requestDocumentTool = useWorkspaceStore(state => state.requestDocumentTool)
  const saveCurrentDocument = useWorkspaceStore(state => state.saveCurrentDocument)
  const updateDocumentBlock = useWorkspaceStore(state => state.updateDocumentBlock)
  const insertDocumentBlock = useWorkspaceStore(state => state.insertDocumentBlock)
  const deleteDocumentBlock = useWorkspaceStore(state => state.deleteDocumentBlock)
  const toggleBlockType = useWorkspaceStore(state => state.toggleBlockType)
  const applyInlineMarkdown = useWorkspaceStore(state => state.applyInlineMarkdown)
  const setRightPanelMode = useWorkspaceStore(state => state.setRightPanelMode)
  const [activeSelection, setActiveSelection] = useState<{ blockId: string } & InlineMarkdownSelection | null>(null)
  const selectedReferenceIds = selectedReferenceId
    ? [selectedReferenceId]
    : graphNodes.find(node => node.id === selectedGraphNodeId)?.referenceIds ?? []
  const isGenerating = ['retrieving', 'reasoning', 'generating'].includes(aiRunStatus)
  const activeBlock = documentBlocks.find(block => block.id === selectedBlockId) ?? documentBlocks[0]
  const currentBlockType = activeBlock?.type ?? 'paragraph'
  const firstHeadingText = documentBlocks.find(block => block.type === 'heading')?.content.trim()
  const documentTitle = firstHeadingText && !/^\d+[.、]/.test(firstHeadingText)
    ? firstHeadingText
    : '基于深度学习的图像分类方法综述'

  const citationCount = documentBlocks.reduce((count, block) => count + (block.citations?.length ?? 0), 0)
  const paragraphBlocks = documentBlocks.filter(block => block.type === 'paragraph')
  const wordCount = paragraphBlocks.reduce((count, block) => count + block.content.length, 0)
  const citedParagraphCount = paragraphBlocks.filter(block => (block.citations?.length ?? 0) > 0).length
  const citationRiskSummary = buildCitationRiskSummary(paragraphBlocks, references.map(reference => reference.id), ragPapers.length)
  const citationCoverage = paragraphBlocks.length > 0
    ? Math.round((citedParagraphCount / paragraphBlocks.length) * 100)
    : 0

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-scholar-border bg-white shadow-sm">
      <DocumentToolbar
        currentBlockType={currentBlockType}
        saveStatus={saveStatus}
        onSave={() => void saveCurrentDocument()}
        onFormat={(command) => {
          const selection = activeSelection?.blockId === selectedBlockId ? activeSelection : undefined
          applyInlineMarkdown(command, selection)
        }}
        onToggleBlockType={() => activeBlock && toggleBlockType(activeBlock.id)}
        onOpenReferences={() => setRightPanelMode('list')}
      />
      <div className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-white to-[#fbfcff] p-6">
        <div className="mx-auto flex max-w-5xl gap-5">
          <div className="min-w-0 flex-1 rounded-lg bg-white px-8 py-7 shadow-[0_18px_70px_rgba(36,50,100,0.08)]">
            <div className="mb-7 border-b border-scholar-border pb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-scholar-primary">Academic Draft</p>
              <h1 className="text-2xl font-black tracking-tight text-slate-950">{documentTitle}</h1>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-scholar-text-weak">
                <span>字数：{wordCount}</span>
                <span>引用：{citationCount}</span>
                <span>注释：3</span>
                <span className="text-emerald-600">结构完整度 86%</span>
              </div>
              <CitationCoverageCard
                coverage={citationCoverage}
                summary={citationRiskSummary}
                onSelectBlock={setSelectedBlock}
                onEnhanceBlock={requestCitationEnhancement}
                isEnhancementDisabled={isGenerating}
              />
            </div>

            <div className="space-y-4">
              {documentBlocks.map(block => (
                <DocumentBlockView
                  key={block.id}
                  block={block}
                  active={selectedBlockId === block.id}
                  isEnhancing={
                    isGenerating && citationEnhancementRequest?.blockId === block.id
                  }
                  isCitationEnhanceDisabled={isGenerating}
                  areDocumentToolsDisabled={isGenerating}
                  onSelect={() => setSelectedBlock(block.id)}
                  onUpdate={(patch) => updateDocumentBlock(block.id, patch)}
                  onInsertAfter={(nextBlock) => insertDocumentBlock(block.id, nextBlock)}
                  onDelete={() => deleteDocumentBlock(block.id)}
                  onSelectionChange={(selection) => setActiveSelection({ blockId: block.id, ...selection })}
                  onDocumentTool={(tool) => requestDocumentTool(tool, block.id)}
                  onCitationEnhance={() => requestCitationEnhancement(block.id)}
                  onCitationClick={(referenceId) => selectCitationReference(referenceId, block.id)}
                  selectedReferenceIds={selectedReferenceIds}
                />
              ))}
            </div>
          </div>
          <DocumentOutlineCard blocks={documentBlocks} />
        </div>
      </div>
    </article>
  )
}

function CitationCoverageCard({
  coverage,
  summary,
  onSelectBlock,
  onEnhanceBlock,
  isEnhancementDisabled,
}: {
  coverage: number
  summary: CitationRiskSummary
  onSelectBlock: (id: string) => void
  onEnhanceBlock: (id: string) => void
  isEnhancementDisabled: boolean
}) {
  const riskItems = summary.items.filter(item => item.level !== 'matched')

  return (
    <section className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-amber-700">引用覆盖率 {coverage}%</span>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-medium text-amber-700">
          <span className="rounded-md bg-white/70 px-1.5 py-0.5">缺少引用 {summary.missingCount}</span>
          <span className="rounded-md bg-white/70 px-1.5 py-0.5">待核验引用 {summary.unmatchedCount}</span>
          <span className="rounded-md bg-white/70 px-1.5 py-0.5">已匹配文献 {summary.matchedCount}</span>
          <span className="rounded-md bg-white/70 px-1.5 py-0.5">本轮检索文献 {summary.dynamicReferenceCount}</span>
        </div>
      </div>

      {riskItems.length > 0 && (
        <div className="mt-2 space-y-1">
          {riskItems.map(item => (
            <div key={`${item.level}-${item.block.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1 text-[11px] leading-5 text-amber-800 transition hover:bg-amber-100">
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => onSelectBlock(item.block.id)}
                title="定位风险段落"
              >
                <span className="mr-1 rounded bg-amber-200/70 px-1 py-0.5 text-[10px] font-semibold">
                  {citationRiskLabel(item.level)}
                </span>
                {item.block.title ? `${item.block.title}：` : ''}
                {item.block.content}
              </button>
              {item.level === 'missing' && (
                <button
                  type="button"
                  aria-label={`风险引用增强 ${item.block.id}`}
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition ${
                    isEnhancementDisabled
                      ? 'cursor-not-allowed bg-amber-100 text-amber-500'
                      : 'bg-amber-200/70 text-amber-800 hover:bg-amber-300'
                  }`}
                  onClick={() => onEnhanceBlock(item.block.id)}
                  disabled={isEnhancementDisabled}
                >
                  {isEnhancementDisabled ? '生成中' : '引用增强'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

interface CitationRiskItem {
  block: DocumentBlock
  level: CitationRiskLevel
}

interface CitationRiskSummary {
  items: CitationRiskItem[]
  missingCount: number
  unmatchedCount: number
  matchedCount: number
  dynamicReferenceCount: number
}

function buildCitationRiskSummary(
  blocks: DocumentBlock[],
  referenceIds: string[],
  dynamicReferenceCount: number,
): CitationRiskSummary {
  const referenceIdSet = new Set(referenceIds)
  let missingCount = 0
  let unmatchedCount = 0
  let matchedCount = 0

  const items = blocks.map((block): CitationRiskItem => {
    const citations = block.citations ?? []
    if (citations.length === 0) {
      missingCount += 1
      return { block, level: 'missing' }
    }

    const unmatched = citations.filter(citation => !referenceIdSet.has(citation.referenceId))
    if (unmatched.length > 0) {
      unmatchedCount += unmatched.length
      matchedCount += citations.length - unmatched.length
      return { block, level: 'unmatched' }
    }

    matchedCount += citations.length
    return { block, level: 'matched' }
  })

  return {
    items,
    missingCount,
    unmatchedCount,
    matchedCount,
    dynamicReferenceCount,
  }
}

function citationRiskLabel(level: CitationRiskLevel): string {
  switch (level) {
    case 'missing':
      return '缺少引用'
    case 'unmatched':
      return '待核验引用'
    case 'matched':
      return '已匹配文献'
  }
}

function DocumentBlockView({
  block,
  active,
  isEnhancing,
  isCitationEnhanceDisabled,
  areDocumentToolsDisabled,
  onSelect,
  onDocumentTool,
  onCitationEnhance,
  onCitationClick,
  selectedReferenceIds,
  onUpdate,
  onInsertAfter,
  onDelete,
  onSelectionChange,
}: {
  block: DocumentBlock
  active: boolean
  isEnhancing: boolean
  isCitationEnhanceDisabled: boolean
  areDocumentToolsDisabled: boolean
  onSelect: () => void
  onDocumentTool: (tool: DocumentToolMode) => void
  onCitationEnhance: () => void
  onCitationClick: (referenceId: string) => void
  selectedReferenceIds: string[]
  onUpdate: (patch: Partial<DocumentBlock>) => void
  onInsertAfter: (block: DocumentBlock) => void
  onDelete: () => void
  onSelectionChange: (selection: InlineMarkdownSelection) => void
}) {
  const updateSelection = (target: HTMLTextAreaElement | HTMLInputElement) => {
    onSelectionChange({
      start: target.selectionStart ?? 0,
      end: target.selectionEnd ?? target.value.length,
    })
  }

  const handleParagraphKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      const textarea = event.currentTarget
      const start = textarea.selectionStart ?? block.content.length
      const end = textarea.selectionEnd ?? start
      const before = block.content.slice(0, start)
      const after = block.content.slice(end)
      onUpdate({ content: before })
      onInsertAfter({
        id: `paragraph-${Date.now()}`,
        type: 'paragraph',
        content: after,
      })
      return
    }

    if (event.key === 'Backspace' && block.content.length === 0) {
      event.preventDefault()
      onDelete()
    }
  }

  const handleHeadingKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return

    event.preventDefault()
    onInsertAfter({
      id: `paragraph-${Date.now()}`,
      type: 'paragraph',
      content: '',
    })
  }

  if (block.type === 'heading') {
    return (
      <div
        id={block.id}
        className={`rounded-lg border px-3 py-2 transition ${
          active ? 'border-blue-200 bg-blue-50/40' : 'border-transparent hover:border-scholar-border hover:bg-scholar-bg-canvas/70'
        }`}
        onMouseEnter={onSelect}
      >
        <input
          aria-label={`编辑标题 ${block.id}`}
          className="w-full bg-transparent text-xl font-extrabold text-scholar-primary outline-none"
          value={block.content}
          onFocus={(event) => {
            onSelect()
            updateSelection(event.currentTarget)
          }}
          onClick={(event) => updateSelection(event.currentTarget)}
          onSelect={(event) => updateSelection(event.currentTarget)}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onUpdate({ content: event.target.value })}
          onKeyDown={handleHeadingKeyDown}
        />
      </div>
    )
  }

  return (
    <section
      id={block.id}
      className={`group relative rounded-2xl border px-4 py-3 transition ${
        active ? 'border-blue-200 bg-blue-50/40' : 'border-transparent hover:border-scholar-border hover:bg-scholar-bg-canvas/70'
      } ${isEnhancing ? 'ring-2 ring-amber-300/60' : ''}`}
      onMouseEnter={onSelect}
      onFocus={onSelect}
    >
      {isEnhancing && (
        <div className="absolute inset-x-0 top-0 flex h-0.5 overflow-hidden rounded-t-2xl">
          <div className="animate-[shimmer_1.5s_linear_infinite] w-1/3 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
        </div>
      )}
      {block.title && <h3 className="mb-2 text-base font-bold text-scholar-primary">{block.title}</h3>}
      <textarea
        aria-label={`编辑段落 ${block.id}`}
        className="min-h-28 w-full resize-y bg-transparent text-[15px] leading-8 text-slate-800 outline-none"
        value={block.content}
        rows={Math.max(4, block.content.split('\n').length + 1)}
        onFocus={(event) => {
          onSelect()
          updateSelection(event.currentTarget)
        }}
        onClick={(event) => updateSelection(event.currentTarget)}
        onSelect={(event) => updateSelection(event.currentTarget)}
        onKeyUp={(event) => updateSelection(event.currentTarget)}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onUpdate({ content: event.target.value })}
        onKeyDown={handleParagraphKeyDown}
      />
      {block.citations && block.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {block.citations.map(citation => (
            <CitationHighlight
              key={citation.id}
              active={selectedReferenceIds.includes(citation.referenceId)}
              onClick={() => onCitationClick(citation.referenceId)}
            >
              {citation.label}
            </CitationHighlight>
          ))}
        </div>
      )}
      <div className="absolute right-3 top-3 hidden items-center gap-1 rounded-xl border border-blue-100 bg-white/95 p-1 shadow-lg shadow-blue-100 group-hover:flex">
        <Sparkles size={14} className="ml-1 text-scholar-primary" />
        {actionItems.map(item => {
          const isCitation = item.kind === 'citation'
          const disabled = isCitation ? isCitationEnhanceDisabled : areDocumentToolsDisabled

          return (
          <button
            key={item.label}
            aria-label={`${item.label} ${block.id}`}
            className={`rounded-lg px-2 py-1 text-xs font-semibold transition ${
              disabled
                ? 'cursor-not-allowed text-scholar-text-weak'
                : 'text-scholar-text-secondary hover:bg-blue-50 hover:text-scholar-primary'
            }`}
            onClick={isCitation ? onCitationEnhance : () => onDocumentTool(item.kind)}
            disabled={disabled}
          >
            {isCitation && isEnhancing
              ? <Loader2 size={12} className="animate-spin" />
              : item.label}
          </button>
          )
        })}
      </div>
    </section>
  )
}
