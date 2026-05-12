import { BookCheck, Globe2, Library, Network, Send, Square, WandSparkles, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { connectSSE, type SSEController } from '../../api/sse'
import { analyzeWriting } from '../../api/writing'
import { useLayoutStore } from '../../store/layout'
import { useWorkspaceStore } from '../../store/workspace'

type QuickModeId = 'deep' | 'web' | 'citation' | 'graph' | 'norms'

const quickModes: Array<{ id: QuickModeId; label: string; icon: LucideIcon }> = [
  { id: 'deep', label: '深度思考', icon: WandSparkles },
  { id: 'web', label: '联网搜索', icon: Globe2 },
  { id: 'citation', label: '引用增强', icon: Library },
  { id: 'graph', label: '图谱检索', icon: Network },
  { id: 'norms', label: '学术规范', icon: BookCheck },
]

export function AIChatInput() {
  const [input, setInput] = useState('')
  const [selectedMode, setSelectedMode] = useState<QuickModeId>('deep')
  const workbenchContext = useLayoutStore(state => state.workbenchContext)
  const controllerRef = useRef<SSEController | null>(null)
  const handledCitationRequestIdRef = useRef<string | null>(null)
  const aiRunStatus = useWorkspaceStore(state => state.aiRunStatus)
  const activeSessionId = useWorkspaceStore(state => state.activeSessionId)
  const citationEnhancementRequest = useWorkspaceStore(state => state.citationEnhancementRequest)
  const startAIRun = useWorkspaceStore(state => state.startAIRun)
  const startCitationEnhancement = useWorkspaceStore(state => state.startCitationEnhancement)
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

  const runAIRequest = useCallback((
    userRequest: string,
    mode: 'rewrite' | 'citation_enhance' = 'rewrite',
    targetBlockId?: string,
  ) => {
    const trimmedRequest = userRequest.trim()
    if (!trimmedRequest || isGenerating) return

    controllerRef.current?.abort()

    const targetBlock = mode === 'citation_enhance'
      ? startCitationEnhancement(targetBlockId ?? '')
      : startAIRun(targetBlockId)

    if (!targetBlock) {
      failAIRunWithFallback('当前文档没有可改写的正文段落')
      return
    }

    const modeInstruction = getModeInstruction(selectedMode)
    const instruction = mode === 'citation_enhance'
      ? '请对下方目标段落进行引用增强：在保持原意的前提下补充学术依据、引用线索和可被文献支撑的表述，只输出修改后的段落正文，不要输出解释、标题或 Markdown 列表。'
      : '请根据用户需求改写下方目标段落，只输出修改后的段落正文，不要输出解释、标题或 Markdown 列表。'

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

  const handleSend = () => {
    if (!input.trim() || isGenerating) return
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
            const active = selectedMode === mode.id
            return (
              <button
                key={mode.label}
                type="button"
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  active
                    ? 'border-scholar-primary/40 bg-blue-50 text-scholar-primary'
                    : 'border-scholar-border text-scholar-text-secondary hover:border-scholar-primary/30 hover:bg-blue-50 hover:text-scholar-primary'
                }`}
                onClick={isCitationEnhance
                  ? () => runAIRequest('引用增强：请为当前段落补充学术依据和引用支撑。', 'citation_enhance', selectedBlockId ?? undefined)
                  : () => setSelectedMode(mode.id)}
                disabled={isCitationEnhance && isGenerating}
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

function getModeInstruction(mode: QuickModeId): string {
  switch (mode) {
    case 'deep':
      return '模式：深度思考。请优先分析论证结构、概念边界和潜在反例。'
    case 'web':
      return '模式：联网搜索意图。当前后端未接入实时公网搜索，请明确标注需要用户核验的外部事实。'
    case 'graph':
      return '模式：图谱检索。请优先结合已检索到的文献、研究空白和概念关系组织修改。'
    case 'norms':
      return '模式：学术规范。请依据学术写作、论文格式、引用规范和表达规范给出修改。'
    case 'citation':
      return ''
  }
}
