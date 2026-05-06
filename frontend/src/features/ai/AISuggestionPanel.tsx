import { Bot, Check, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { useState } from 'react'
import { useWorkspaceStore } from '../../store/workspace'
import type { AIRunStatus } from '../../types/workspace'
import { DiffViewer } from './DiffViewer'
import { ReasoningPanel } from './ReasoningPanel'

type SuggestionTab = 'suggestion' | 'diff' | 'reason' | 'thinking'

const tabs: Array<{ id: SuggestionTab; label: string }> = [
  { id: 'suggestion', label: '修改建议' },
  { id: 'diff', label: '对比视图' },
  { id: 'reason', label: '修改理由' },
  { id: 'thinking', label: '思考过程' },
]

export function AISuggestionPanel() {
  const [activeTab, setActiveTab] = useState<SuggestionTab>('diff')
  const currentSuggestion = useWorkspaceStore(state => state.currentSuggestion)
  const currentChangeIndex = useWorkspaceStore(state => state.currentChangeIndex)
  const aiRunStatus = useWorkspaceStore(state => state.aiRunStatus)
  const aiRunMode = useWorkspaceStore(state => state.aiRunMode)
  const aiStageLabel = useWorkspaceStore(state => state.aiStageLabel)
  const aiErrorMessage = useWorkspaceStore(state => state.aiErrorMessage)
  const restoreSessionNotice = useWorkspaceStore(state => state.restoreSessionNotice)
  const citationEnhancementRequest = useWorkspaceStore(state => state.citationEnhancementRequest)
  const setCurrentChangeIndex = useWorkspaceStore(state => state.setCurrentChangeIndex)
  const previousChange = useWorkspaceStore(state => state.previousChange)
  const nextChange = useWorkspaceStore(state => state.nextChange)
  const acceptCurrentChange = useWorkspaceStore(state => state.acceptCurrentChange)
  const acceptSuggestion = useWorkspaceStore(state => state.acceptSuggestion)
  const rejectSuggestion = useWorkspaceStore(state => state.rejectSuggestion)

  const totalChanges = currentSuggestion?.changes.length ?? 0
  const statusLabel = getStatusLabel(aiRunStatus, aiStageLabel)
  const isRunning = ['retrieving', 'reasoning', 'generating'].includes(aiRunStatus)
  const showCitationEnhanceBanner = isRunning && aiRunMode === 'citation_enhance' && !!citationEnhancementRequest

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-scholar-primary">
              <Bot size={17} />
            </span>
            <h2 className="text-base font-black">AI 助手</h2>
            {currentSuggestion && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">可审阅</span>
            )}
            {currentSuggestion?.title && currentSuggestion.title !== 'AI 生成的修改建议' && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{currentSuggestion.title}</span>
            )}
          </div>
          <p className="mt-2 text-sm text-scholar-text-secondary">
            {currentSuggestion?.summary ?? '暂无待处理修改建议。您可以在下方输入需求，让 AI 生成可审阅的文档修改。'}
          </p>
          {aiRunStatus !== 'idle' && (
            <div className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClassName(aiRunStatus)}`}>
              <span>{statusLabel}</span>
              {aiRunStatus === 'error' && aiErrorMessage ? <span>：{aiErrorMessage}</span> : null}
            </div>
          )}
          {showCitationEnhanceBanner && (
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
              <Loader2 size={14} className="shrink-0 animate-spin text-amber-600" />
              <span className="text-xs font-semibold text-amber-700">正在为段落生成引用增强建议...</span>
            </div>
          )}
          {restoreSessionNotice && (
            <div className="mt-2 text-xs font-semibold text-amber-700">
              {restoreSessionNotice}
            </div>
          )}
        </div>
        {currentSuggestion && (
          <div className="flex items-center gap-2 text-xs text-scholar-text-weak">
            <span>{currentChangeIndex + 1}/{totalChanges} 处修改</span>
          </div>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              activeTab === tab.id ? 'bg-blue-50 text-scholar-primary' : 'text-scholar-text-secondary hover:bg-scholar-bg-canvas'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-600">删除</span>
          <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-600">新增</span>
          <span className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-600">修改</span>
        </div>
      </div>

      {currentSuggestion ? (
        <div className="space-y-3">
          {activeTab === 'suggestion' && (
            <div className="grid gap-2">
              {currentSuggestion.changes.map((change, index) => (
                <button
                  key={change.id}
                  className="rounded-xl border border-scholar-border bg-white px-3 py-2 text-left transition hover:border-scholar-primary/30 hover:bg-blue-50/40"
                  onClick={() => setCurrentChangeIndex(index)}
                >
                  <div className="text-sm font-bold text-scholar-text-primary">建议 {index + 1}：{change.reason}</div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-scholar-text-secondary">{change.revisedText}</p>
                </button>
              ))}
            </div>
          )}
          {activeTab === 'diff' && (
            <DiffViewer suggestion={currentSuggestion} currentIndex={currentChangeIndex} onSelectChange={setCurrentChangeIndex} />
          )}
          {activeTab === 'reason' && (
            <ul className="space-y-2">
              {currentSuggestion.reasons.map(reason => (
                <li key={reason} className="rounded-xl bg-amber-50/70 px-3 py-2 text-sm leading-6 text-amber-800">{reason}</li>
              ))}
            </ul>
          )}
          {activeTab === 'thinking' && <ReasoningPanel steps={currentSuggestion.reasoningSteps} />}

          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-scholar-primary transition hover:bg-blue-100"
              onClick={acceptSuggestion}
            >
              <Check size={15} />
              接受全部
            </button>
            <button
              className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              onClick={acceptCurrentChange}
            >
              <Check size={15} />
              接受当前
            </button>
            <button
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-100"
              onClick={rejectSuggestion}
            >
              <X size={15} />
              拒绝全部
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button
                className="flex items-center gap-1 rounded-lg border border-scholar-border px-3 py-1.5 text-sm text-scholar-text-secondary transition hover:bg-scholar-bg-canvas disabled:opacity-40"
                disabled={currentChangeIndex === 0}
                onClick={previousChange}
              >
                <ChevronLeft size={15} />
                上一处
              </button>
              <button
                className="flex items-center gap-1 rounded-lg border border-scholar-border px-3 py-1.5 text-sm text-scholar-text-secondary transition hover:bg-scholar-bg-canvas disabled:opacity-40"
                disabled={currentChangeIndex >= totalChanges - 1}
                onClick={nextChange}
              >
                下一处
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-32 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-scholar-border bg-scholar-bg-canvas text-center text-sm text-scholar-text-secondary">
          <span>暂无待处理修改建议</span>
          <span className="text-xs text-scholar-text-weak">AI 修改必须经过审查后才会写入正文。</span>
        </div>
      )}
    </div>
  )
}

function getStatusLabel(status: AIRunStatus, stageLabel: string): string {
  if (stageLabel) return stageLabel

  switch (status) {
    case 'retrieving':
      return '正在检索'
    case 'reasoning':
      return '正在分析'
    case 'generating':
      return '正在生成'
    case 'done':
      return '生成完成'
    case 'error':
      return '当前流式生成连接异常，系统已切换到本地示例建议以保留审查流程。'
    case 'canceled':
      return '已停止生成'
    case 'idle':
      return ''
  }
}

function getStatusClassName(status: AIRunStatus): string {
  if (status === 'error') return 'bg-red-50 text-red-600'
  if (status === 'canceled') return 'bg-slate-100 text-scholar-text-secondary'
  if (status === 'done') return 'bg-emerald-50 text-emerald-600'
  return 'bg-blue-50 text-scholar-primary'
}
