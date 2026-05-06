import type { DocumentSuggestion } from '../../types/workspace'
import { getChangeTone, getCurrentChange } from '../../utils/diff'

export function DiffViewer({
  suggestion,
  currentIndex,
  onSelectChange,
}: {
  suggestion: DocumentSuggestion
  currentIndex: number
  onSelectChange: (index: number) => void
}) {
  const currentChange = getCurrentChange(suggestion.changes, currentIndex)

  if (!currentChange) {
    return <p className="rounded-xl bg-scholar-bg-canvas p-4 text-sm text-scholar-text-secondary">暂无变更内容。</p>
  }

  const tone = getChangeTone(currentChange.type)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {suggestion.changes.map((change, index) => {
          const changeTone = getChangeTone(change.type)
          return (
            <button
              key={change.id}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                index === currentIndex ? 'bg-scholar-primary text-white' : changeTone.badgeClassName
              }`}
              onClick={() => onSelectChange(index)}
            >
              {index + 1}. {changeTone.label}
            </button>
          )
        })}
      </div>

      <div className="grid min-h-[148px] grid-cols-2 overflow-hidden rounded-2xl border border-scholar-border">
        <div className="border-r border-scholar-border bg-white">
          <div className="border-b border-scholar-border px-4 py-2 text-xs font-bold text-scholar-text-secondary">原文（v3.1）</div>
          <p className="p-4 text-sm leading-7 text-slate-700">
            <span className="rounded-lg bg-red-50 px-1 py-0.5 text-red-600 line-through decoration-red-400">
              {currentChange.originalText}
            </span>
          </p>
        </div>
        <div className="bg-white">
          <div className="border-b border-scholar-border px-4 py-2 text-xs font-bold text-scholar-text-secondary">修改后（v3.2）</div>
          <p className="p-4 text-sm leading-7 text-slate-700">
            <span className={`rounded-lg px-1 py-0.5 ${tone.panelClassName}`}>{currentChange.revisedText}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
