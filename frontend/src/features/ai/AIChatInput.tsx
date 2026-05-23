import { BookCheck, FilePenLine, Globe2, Library, Network, Send, Sparkles, Square, WandSparkles, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { connectEditingJobSSE, createEditingJob, type EditingMode, type EditingSSEController } from '../../api/editing'
import { connectSSE, type SSEController } from '../../api/sse'
import { analyzeWriting } from '../../api/writing'
import { useLayoutStore } from '../../store/layout'
import { useWorkspaceStore, type DocumentToolMode } from '../../store/workspace'
import type { DocumentBlock } from '../../types/workspace'

type QuickModeId = 'deep' | 'academic' | 'originality' | 'web' | 'citation' | 'graph' | 'norms'

const quickModes: Array<{ id: QuickModeId; label: string; icon: LucideIcon; disabledReason?: string }> = [
  { id: 'deep', label: '深度编辑', icon: WandSparkles },
  { id: 'academic', label: '学术增强', icon: FilePenLine },
  { id: 'originality', label: '降重', icon: Sparkles },
  { id: 'web', label: '联网搜索', icon: Globe2, disabledReason: '后端未配置实时公网搜索，暂不可用' },
  { id: 'citation', label: '引用增强', icon: Library },
  { id: 'graph', label: '图谱检索', icon: Network },
  { id: 'norms', label: '学术规范', icon: BookCheck },
]

export function AIChatInput() {
  const [input, setInput] = useState('')
  const [selectedMode, setSelectedMode] = useState<QuickModeId>('graph')
  const workbenchContext = useLayoutStore(state => state.workbenchContext)
  const controllerRef = useRef<SSEController | EditingSSEController | null>(null)
  const handledCitationRequestIdRef = useRef<string | null>(null)
  const handledDocumentToolRequestIdRef = useRef<string | null>(null)
  const aiRunStatus = useWorkspaceStore(state => state.aiRunStatus)
  const activeSessionId = useWorkspaceStore(state => state.activeSessionId)
  const citationEnhancementRequest = useWorkspaceStore(state => state.citationEnhancementRequest)
  const documentToolRequest = useWorkspaceStore(state => state.documentToolRequest)
  const documentBlocks = useWorkspaceStore(state => state.documentBlocks)
  const startAIRun = useWorkspaceStore(state => state.startAIRun)
  const startDocumentToolRun = useWorkspaceStore(state => state.startDocumentToolRun)
  const startCitationEnhancement = useWorkspaceStore(state => state.startCitationEnhancement)
  const startEditingRun = useWorkspaceStore(state => state.startEditingRun)
  const applyEditingStage = useWorkspaceStore(state => state.applyEditingStage)
  const applyEditingPatch = useWorkspaceStore(state => state.applyEditingPatch)
  const applyEditingGate = useWorkspaceStore(state => state.applyEditingGate)
  const upsertEditingReferences = useWorkspaceStore(state => state.upsertEditingReferences)
  const finishEditingRun = useWorkspaceStore(state => state.finishEditingRun)
  const failEditingRun = useWorkspaceStore(state => state.failEditingRun)
  const setAIStage = useWorkspaceStore(state => state.setAIStage)
  const setActiveSessionId = useWorkspaceStore(state => state.setActiveSessionId)
  const appendGeneratedToken = useWorkspaceStore(state => state.appendGeneratedToken)
  const finishAIRunAsSuggestion = useWorkspaceStore(state => state.finishAIRunAsSuggestion)
  const failAIRunWithFallback = useWorkspaceStore(state => state.failAIRunWithFallback)
  const cancelAIRun = useWorkspaceStore(state => state.cancelAIRun)
  const upsertRagPapers = useWorkspaceStore(state => state.upsertRagPapers)
  const upsertRagGaps = useWorkspaceStore(state => state.upsertRagGaps)
  const selectedBlockId = useWorkspaceStore(state => state.selectedBlockId)

  useEffect(() => () => {
    controllerRef.current?.abort()
  }, [])

  const isGenerating = ['retrieving', 'reasoning', 'generating'].includes(aiRunStatus)

  const runEditingRequest = useCallback(async (
    userRequest: string,
    editingMode: EditingMode,
    targetBlockId?: string | null,
  ) => {
    const trimmedRequest = userRequest.trim()
    if (!trimmedRequest || isGenerating) return

    const targetBlock = findTargetParagraph(documentBlocks, targetBlockId ?? selectedBlockId)
    if (!targetBlock) {
      failEditingRun('当前文档没有可编辑的正文段落')
      return
    }

    controllerRef.current?.abort()
    setAIStage('retrieving', '正在创建 DeepSeek V4 编辑任务')

    try {
      const job = await createEditingJob({
        blocks: documentBlocks,
        selected_block_ids: [targetBlock.id],
        mode: editingMode,
        objective: [
          getContextInstruction(workbenchContext),
          getModeInstruction(selectedMode),
          `用户需求：${trimmedRequest}`,
        ].filter(Boolean).join('\n\n'),
        session_id: activeSessionId ?? undefined,
      })

      startEditingRun({ jobId: job.job_id, stages: job.stages, targetBlockId: targetBlock.id })
      controllerRef.current = connectEditingJobSSE(job.job_id, {
        onEditingStage: applyEditingStage,
        onEditingPatch: applyEditingPatch,
        onEditingGate: applyEditingGate,
        onReferences: upsertEditingReferences,
        onDone: () => {
          finishEditingRun()
          setInput('')
        },
        onError: failEditingRun,
      })
    } catch (error) {
      failEditingRun(error instanceof Error ? error.message : '编辑任务创建失败')
    }
  }, [
    activeSessionId,
    applyEditingGate,
    applyEditingPatch,
    applyEditingStage,
    documentBlocks,
    failEditingRun,
    finishEditingRun,
    isGenerating,
    selectedBlockId,
    selectedMode,
    setAIStage,
    startEditingRun,
    upsertEditingReferences,
    workbenchContext,
  ])

  const runAIRequest = useCallback((
    userRequest: string,
    mode: 'rewrite' | DocumentToolMode | 'citation_enhance' = 'rewrite',
    targetBlockId?: string,
  ) => {
    const trimmedRequest = userRequest.trim()
    if (!trimmedRequest || isGenerating) return

    controllerRef.current?.abort()

    const targetBlock = mode === 'citation_enhance'
      ? startCitationEnhancement(targetBlockId ?? '')
      : mode === 'rewrite'
        ? startAIRun(targetBlockId)
        : startDocumentToolRun(mode, targetBlockId ?? '')

    if (!targetBlock) {
      failAIRunWithFallback('当前文档没有可改写的正文段落')
      return
    }

    const modeInstruction = getModeInstruction(selectedMode)
    const instruction = getDocumentInstruction(mode)

    const prompt = [
      getContextInstruction(workbenchContext),
      modeInstruction,
      instruction,
      `用户需求：${trimmedRequest}`,
      `目标段落：${targetBlock.content}`,
    ].filter(Boolean).join('\n\n')

    if (mode === 'citation_enhance') {
      void analyzeWriting({
        text: targetBlock.content,
        mode: 'citation',
        session_id: activeSessionId ?? undefined,
      }).then((analysis) => {
        useWorkspaceStore.getState().upsertReferences(analysis.references)
      }).catch(() => {
        // Citation analysis enriches evidence when available; SSE generation remains the primary user action.
      })
    }

    controllerRef.current = connectSSE(prompt, {
      onSessionId: (sessionId) => setActiveSessionId(sessionId),
      onStage: (stage) => {
        const normalizedStage = stage.trim()
        if (normalizedStage.includes('检索') || normalizedStage.includes('文献')) {
          setAIStage('retrieving', mode === 'citation_enhance' ? '正在检索文献支撑' : '正在检索')
          return
        }
        if (normalizedStage.includes('思考') || normalizedStage.includes('分析') || normalizedStage.includes('推理')) {
          setAIStage('reasoning', '正在分析')
          return
        }
        setAIStage('generating', normalizedStage || '正在生成')
      },
      onPapers: (papers) => upsertRagPapers(papers),
      onGaps: (gaps) => upsertRagGaps(gaps),
      onReferences: (references) => useWorkspaceStore.getState().upsertReferences(references),
      onToken: (token) => appendGeneratedToken(token),
      onDone: () => {
        finishAIRunAsSuggestion()
        setInput('')
      },
      onError: (message) => {
        failAIRunWithFallback(message)
      },
    }, activeSessionId ?? undefined, selectedMode === 'norms' ? 'norms' : undefined)
  }, [
    activeSessionId,
    appendGeneratedToken,
    failAIRunWithFallback,
    finishAIRunAsSuggestion,
    isGenerating,
    selectedMode,
    setActiveSessionId,
    setAIStage,
    startAIRun,
    startCitationEnhancement,
    startDocumentToolRun,
    upsertRagGaps,
    upsertRagPapers,
    workbenchContext,
  ])

  useEffect(() => {
    if (!citationEnhancementRequest) return
    if (handledCitationRequestIdRef.current === citationEnhancementRequest.id) return

    handledCitationRequestIdRef.current = citationEnhancementRequest.id
    runAIRequest('引用增强：请为当前段落补充更充分的学术依据和引用支撑。', 'citation_enhance', citationEnhancementRequest.blockId)
  }, [citationEnhancementRequest, runAIRequest])

  useEffect(() => {
    if (!documentToolRequest) return
    if (handledDocumentToolRequestIdRef.current === documentToolRequest.id) return

    handledDocumentToolRequestIdRef.current = documentToolRequest.id
    runAIRequest(getDocumentToolRequest(documentToolRequest.tool), documentToolRequest.tool, documentToolRequest.blockId)
  }, [documentToolRequest, runAIRequest])

  const handleSend = () => {
    if (!input.trim() || isGenerating) return
    if (isEditingQuickMode(selectedMode)) {
      void runEditingRequest(input.trim(), editingModeForQuickMode(selectedMode), selectedBlockId)
      return
    }
    runAIRequest(input.trim())
  }

  const handleStop = () => {
    controllerRef.current?.abort()
    controllerRef.current = null
    cancelAIRun()
  }

  return (
    <div className="border-t border-scholar-border bg-white p-4">
      <div className="rounded-2xl border border-blue-200 bg-white shadow-[0_12px_34px_rgba(51,112,255,0.12)] focus-within:border-scholar-primary">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              handleSend()
            }
          }}
          className="min-h-[58px] max-h-28 w-full resize-none rounded-t-2xl px-4 py-3 text-sm outline-none"
          placeholder={workbenchContext
            ? `当前研究上下文：${workbenchContext.sourceTitle}，输入您的问题或需求`
            : '输入您的问题或需求，使用 @ 引用文献，/ 使用指令'}
        />
        <div className="flex items-center gap-2 border-t border-scholar-border px-3 py-2">
          {quickModes.map(mode => {
            const Icon = mode.icon
            const isCitationEnhance = mode.id === 'citation'
            const isDisabled = !!mode.disabledReason || (isCitationEnhance && isGenerating)
            const active = selectedMode === mode.id
            const buttonClassName = mode.disabledReason
              ? 'cursor-not-allowed border-scholar-border bg-slate-50 text-scholar-text-weak'
              : active
                ? 'border-scholar-primary/40 bg-blue-50 text-scholar-primary'
                : 'border-scholar-border text-scholar-text-secondary hover:border-scholar-primary/30 hover:bg-blue-50 hover:text-scholar-primary'

            return (
              <button
                key={mode.label}
                type="button"
                title={mode.disabledReason}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${buttonClassName}`}
                onClick={isCitationEnhance
                  ? () => void runEditingRequest('引用增强：请为当前段落补充学术依据和引用支撑。', 'citation_enhance', selectedBlockId)
                  : () => setSelectedMode(mode.id)}
                disabled={isDisabled}
                aria-pressed={active}
              >
                <Icon size={14} />
                {mode.label}
              </button>
            )
          })}
          <span className="ml-auto text-xs text-scholar-text-weak">
            {isGenerating ? '生成中' : 'AI 生成内容仅供参考，请注意核实信息准确性。'}
          </span>
          {isGenerating ? (
            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500 text-white transition hover:bg-red-600"
              onClick={handleStop}
              aria-label="停止生成"
            >
              <Square size={15} fill="currentColor" />
            </button>
          ) : (
            <button
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-scholar-primary to-scholar-discovery text-white shadow-md shadow-blue-200 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={handleSend}
              disabled={!input.trim()}
              aria-label="发送"
            >
              <Send size={17} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function getContextInstruction(context: ReturnType<typeof useLayoutStore.getState>['workbenchContext']): string {
  if (!context) return '当前研究上下文：空白工作台'
  return `当前研究上下文：${context.courseTitle ?? '未指定课程'} / ${context.sourceTitle} / ${context.actionType}`
}

function getDocumentInstruction(mode: 'rewrite' | DocumentToolMode | 'citation_enhance'): string {
  switch (mode) {
    case 'document_rewrite':
      return '请对下方目标段落执行改写：保持原意和事实边界，优化学术表达、句式清晰度和段落衔接，只输出改写后的段落正文，不要输出解释、标题或 Markdown 列表。'
    case 'expand':
      return '请对下方目标段落执行扩写：在不引入未经核验事实的前提下补充研究背景、论证依据和必要过渡，只输出扩写后的段落正文，不要输出解释、标题或 Markdown 列表。'
    case 'logic_check':
      return '请对下方目标段落执行逻辑检查：修正论证顺序、概念跳跃、因果衔接和结论支撑问题，只输出逻辑检查后的段落正文，不要输出解释、标题或 Markdown 列表。'
    case 'citation_enhance':
      return '请对下方目标段落进行引用增强：在保持原意的前提下补充学术依据、引用线索和可被文献支撑的表述，只输出修改后的段落正文，不要输出解释、标题或 Markdown 列表。'
    case 'rewrite':
      return '请根据用户需求改写下方目标段落，只输出修改后的段落正文，不要输出解释、标题或 Markdown 列表。'
  }
}

function getDocumentToolRequest(tool: DocumentToolMode): string {
  switch (tool) {
    case 'document_rewrite':
      return '改写：请优化当前段落的学术表达和行文连贯性。'
    case 'expand':
      return '扩写：请为当前段落补充背景、论据和过渡。'
    case 'logic_check':
      return '逻辑检查：请检查并修正当前段落的论证顺序和因果衔接。'
  }
}

function findTargetParagraph(blocks: DocumentBlock[], blockId?: string | null): DocumentBlock | null {
  return (blockId ? blocks.find(block => block.id === blockId && block.type === 'paragraph') : null)
    ?? blocks.find(block => block.type === 'paragraph')
    ?? null
}

function isEditingQuickMode(mode: QuickModeId): boolean {
  return mode === 'deep' || mode === 'academic' || mode === 'originality' || mode === 'citation'
}

function editingModeForQuickMode(mode: QuickModeId): EditingMode {
  switch (mode) {
    case 'citation':
      return 'citation_enhance'
    case 'academic':
      return 'academic_enhance'
    case 'originality':
      return 'originality_humanize'
    case 'deep':
    default:
      return 'deep_edit'
  }
}

function getModeInstruction(mode: QuickModeId): string {
  switch (mode) {
    case 'deep':
      return '模式：深度编辑。请按诊断、润色、学术增强、结构、引文、门禁的流程生成可审阅补丁。'
    case 'academic':
      return '模式：学术增强。请提升学术语体、精确性、凝练度和术语一致性。'
    case 'originality':
      return '模式：降重。请降低表层重复和模板腔，但不得新增事实、引用或改变结论强弱。'
    case 'web':
      return '模式：联网搜索意图。当前后端未接入实时公网搜索，请明确标注需要用户核验的外部事实。'
    case 'graph':
      return '模式：图谱检索。请优先结合已检索到的文献、研究空白和概念关系组织修改。'
    case 'norms':
      return '模式：学术规范。请依据学术写作、论文格式、引用规范和表达规范给出修改。'
    case 'citation':
      return '模式：引用增强。请优先核验论点-证据对应关系，查不到证据必须标记 unresolved。'
  }
}
