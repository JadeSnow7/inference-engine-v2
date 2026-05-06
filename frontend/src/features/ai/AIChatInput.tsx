import { Globe2, Library, Network, Send, Square, WandSparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { connectSSE, type SSEController } from '../../api/sse'
import { useWorkspaceStore } from '../../store/workspace'

const quickModes = [
  { label: '深度思考', icon: WandSparkles },
  { label: '联网搜索', icon: Globe2 },
  { label: '引用增强', icon: Library },
  { label: '图谱检索', icon: Network },
]

export function AIChatInput() {
  const [input, setInput] = useState('')
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

    const instruction = mode === 'citation_enhance'
      ? '请对下方目标段落进行引用增强：在保持原意的前提下补充学术依据、引用线索和可被文献支撑的表述，只输出修改后的段落正文，不要输出解释、标题或 Markdown 列表。'
      : '请根据用户需求改写下方目标段落，只输出修改后的段落正文，不要输出解释、标题或 Markdown 列表。'

    const prompt = [
      instruction,
      `用户需求：${trimmedRequest}`,
      `目标段落：${targetBlock.content}`,
    ].join('\n\n')

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
      onToken: (token) => appendGeneratedToken(token),
      onDone: () => {
        finishAIRunAsSuggestion()
        setInput('')
      },
      onError: (message) => {
        failAIRunWithFallback(message)
      },
    }, activeSessionId ?? undefined)
  }, [
    activeSessionId,
    appendGeneratedToken,
    failAIRunWithFallback,
    finishAIRunAsSuggestion,
    isGenerating,
    setActiveSessionId,
    setAIStage,
    startAIRun,
    startCitationEnhancement,
    upsertRagGaps,
    upsertRagPapers,
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
          placeholder="输入您的问题或需求，使用 @ 引用文献，/ 使用指令"
        />
        <div className="flex items-center gap-2 border-t border-scholar-border px-3 py-2">
          {quickModes.map(mode => {
            const Icon = mode.icon
            const isCitationEnhance = mode.label === '引用增强'
            return (
              <button
                key={mode.label}
                className="flex items-center gap-1.5 rounded-lg border border-scholar-border px-2.5 py-1.5 text-xs font-medium text-scholar-text-secondary transition hover:border-scholar-primary/30 hover:bg-blue-50 hover:text-scholar-primary"
                onClick={isCitationEnhance
                  ? () => runAIRequest('引用增强：请为当前段落补充学术依据和引用支撑。', 'citation_enhance', selectedBlockId ?? undefined)
                  : undefined}
                disabled={isCitationEnhance && isGenerating}
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
